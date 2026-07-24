export interface PostureResult {
  position: 'top' | 'middle' | 'bottom' | 'unknown';
  feedback: string;
  warning?: string;
  isStatic?: boolean;
  confidence: number;
}

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

const indexes = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

const visible = (landmark?: Landmark) => (landmark?.visibility ?? 1) > 0.25;

const distance = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

const midpoint = (a: Landmark, b: Landmark): Landmark => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
});

export const calculateAngle = (pA: Landmark, pB: Landmark, pC: Landmark) => {
  let radians = Math.atan2(pC.y - pB.y, pC.x - pB.x) - Math.atan2(pA.y - pB.y, pA.x - pB.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return angle;
};

const lineAngle = (a: Landmark, b: Landmark) =>
  Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI));

const averageVisibleAngles = (
  landmarks: Landmark[],
  triples: Array<[number, number, number]>,
) => {
  const angles = triples
    .filter(([a, b, c]) => visible(landmarks[a]) && visible(landmarks[b]) && visible(landmarks[c]))
    .map(([a, b, c]) => calculateAngle(landmarks[a], landmarks[b], landmarks[c]));
  if (!angles.length) {
    return null;
  }
  return angles.reduce((sum, value) => sum + value, 0) / angles.length;
};

const visibleAngles = (
  landmarks: Landmark[],
  triples: Array<[number, number, number]>,
) =>
  triples
    .filter(([a, b, c]) => visible(landmarks[a]) && visible(landmarks[b]) && visible(landmarks[c]))
    .map(([a, b, c]) => calculateAngle(landmarks[a], landmarks[b], landmarks[c]));

const createResult = (
  position: 'top' | 'middle' | 'bottom' | 'unknown', 
  feedback: string, 
  warning?: string,
  confidence = 1,
): PostureResult => ({
  position,
  feedback,
  warning,
  isStatic: false,
  confidence,
});

const rulesMap: Record<string, (landmarks: Landmark[]) => PostureResult> = {
  'squat': (landmarks) => {
    const { leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle } = indexes;
    const required = [leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle];
    if (required.some((index) => !visible(landmarks[index]))) {
      return createResult('unknown', 'Step back so your full body is visible.', undefined, 0);
    }

    const shoulderMid = midpoint(landmarks[leftShoulder], landmarks[rightShoulder]);
    const hipMid = midpoint(landmarks[leftHip], landmarks[rightHip]);
    const kneeMid = midpoint(landmarks[leftKnee], landmarks[rightKnee]);
    const ankleMid = midpoint(landmarks[leftAnkle], landmarks[rightAnkle]);
    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const hipWidth = Math.max(0.001, distance(landmarks[leftHip], landmarks[rightHip]));
    const kneeAngle = averageVisibleAngles(landmarks, [
      [leftHip, leftKnee, leftAnkle],
      [rightHip, rightKnee, rightAnkle],
    ]) ?? 180;
    const hipAngle = averageVisibleAngles(landmarks, [
      [leftShoulder, leftHip, leftKnee],
      [rightShoulder, rightHip, rightKnee],
    ]) ?? 180;
    const torsoFromVertical = Math.abs(90 - lineAngle(shoulderMid, hipMid));
    const stanceWidth = distance(landmarks[leftAnkle], landmarks[rightAnkle]) / shoulderWidth;
    const kneeAnkleOffset =
      (Math.abs(landmarks[leftKnee].x - landmarks[leftAnkle].x) +
        Math.abs(landmarks[rightKnee].x - landmarks[rightAnkle].x)) /
      (2 * hipWidth);
    const bodyHeightY = Math.max(0.001, ankleMid.y - shoulderMid.y);
    // Hip depth is steadier than one knee angle when the camera is slightly off-center.
    const hipDepthRatio = (hipMid.y - shoulderMid.y) / bodyHeightY;
    const depthReady = hipMid.y > shoulderMid.y && hipMid.y < kneeMid.y && kneeMid.y < ankleMid.y;

    if (torsoFromVertical > 45) {
      return createResult('middle', 'Keep your chest lifted.', 'Chest up', 0.55);
    }
    if (kneeAnkleOffset > 0.8) {
      return createResult('middle', 'Keep knees tracking over your toes.', 'Knees aligned', 0.58);
    }
    if (stanceWidth < 0.5 || stanceWidth > 1.9) {
      return createResult('middle', 'Stand about shoulder-width apart.', 'Adjust stance', 0.6);
    }
    if (hipDepthRatio >= 0.43 && kneeAngle <= 165 && hipAngle <= 172 && depthReady) {
      return createResult('bottom', 'Great squat depth. Drive up.', undefined, 0.92);
    }
    if (hipDepthRatio <= 0.38 && kneeAngle >= 145 && hipMid.y > shoulderMid.y) {
      return createResult('top', 'Stand tall and brace for the next rep.', undefined, 0.9);
    }
    return createResult('middle', 'Lower with control, then stand tall.', undefined, 0.72);
  },
  'pushup': (landmarks) => {
    const { leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftAnkle, rightAnkle } = indexes;
    const upperBody = [leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist];
    if (upperBody.some((index) => !visible(landmarks[index]))) {
      return createResult('unknown', 'Keep shoulders, elbows, and wrists in frame.', undefined, 0);
    }

    const shoulderMid = midpoint(landmarks[leftShoulder], landmarks[rightShoulder]);
    const wristMid = midpoint(landmarks[leftWrist], landmarks[rightWrist]);
    const hasHips = visible(landmarks[leftHip]) && visible(landmarks[rightHip]);
    const hasAnkles = visible(landmarks[leftAnkle]) && visible(landmarks[rightAnkle]);
    const hipMid = hasHips ? midpoint(landmarks[leftHip], landmarks[rightHip]) : null;
    const ankleMid = hasAnkles ? midpoint(landmarks[leftAnkle], landmarks[rightAnkle]) : null;
    const elbowAngles = visibleAngles(landmarks, [
      [leftShoulder, leftElbow, leftWrist],
      [rightShoulder, rightElbow, rightWrist],
    ]);
    const elbowAngle = elbowAngles.length ? Math.min(...elbowAngles) : 180;
    const extendedElbowAngle = elbowAngles.length ? Math.max(...elbowAngles) : 180;
    const shoulderWristSpan = Math.abs(shoulderMid.x - wristMid.x);
    const shoulderWristDrop = Math.abs(shoulderMid.y - wristMid.y);
    // Push-ups need a side/floor view; front-facing elbow angles are too ambiguous.
    const isSideOrFloorPose = shoulderWristSpan > shoulderWristDrop * 0.8;
    const bodyLineAngle = hipMid && ankleMid ? lineAngle(shoulderMid, ankleMid) : null;
    const hipLineDrift = hipMid && ankleMid
      ? Math.abs(hipMid.y - ((shoulderMid.y + ankleMid.y) / 2))
      : 0;

    if (!isSideOrFloorPose) {
      return createResult('middle', 'Turn sideways so your push-up line is visible.', 'Show side view', 0.48);
    }
    if (bodyLineAngle !== null && bodyLineAngle > 38 && bodyLineAngle < 142) {
      return createResult('middle', 'Keep shoulders, hips, and heels in one line.', 'Straight body line', 0.55);
    }
    if (hipLineDrift > 0.12) {
      return createResult('middle', 'Brace your core and keep hips level.', 'Core tight', 0.58);
    }
    if (elbowAngle <= 105) {
      return createResult('bottom', 'Good push-up depth. Press away.', undefined, 0.9);
    }
    if (elbowAngle >= 145 || extendedElbowAngle >= 160) {
      return createResult('top', 'Arms extended. Control the next descent.', undefined, 0.88);
    }
    return createResult('middle', 'Lower your chest with control.', undefined, 0.72);
  },
  'lunge': (landmarks) => {
    const { leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle } = indexes;
    const required = [leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle];
    if (required.some((index) => !visible(landmarks[index]))) {
      return createResult('unknown', 'Step back so your full body is visible.', undefined, 0);
    }

    const shoulderMid = midpoint(landmarks[leftShoulder], landmarks[rightShoulder]);
    const hipMid = midpoint(landmarks[leftHip], landmarks[rightHip]);
    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const leftKneeAngle = calculateAngle(landmarks[leftHip], landmarks[leftKnee], landmarks[leftAnkle]);
    const rightKneeAngle = calculateAngle(landmarks[rightHip], landmarks[rightKnee], landmarks[rightAnkle]);
    const torsoFromVertical = Math.abs(90 - lineAngle(shoulderMid, hipMid));
    const ankleSpread = Math.abs(landmarks[leftAnkle].x - landmarks[rightAnkle].x) / shoulderWidth;
    const kneeHeightGap = Math.abs(landmarks[leftKnee].y - landmarks[rightKnee].y);

    // Use the more-bent leg as the front leg so mirrored cameras behave the same.
    const leftIsFront = leftKneeAngle <= rightKneeAngle;
    const frontKnee = leftIsFront ? landmarks[leftKnee] : landmarks[rightKnee];
    const frontAnkle = leftIsFront ? landmarks[leftAnkle] : landmarks[rightAnkle];
    const backKneeAngle = leftIsFront ? rightKneeAngle : leftKneeAngle;
    const frontKneeAngle = leftIsFront ? leftKneeAngle : rightKneeAngle;
    const frontKneeOverAnkle = Math.abs(frontKnee.x - frontAnkle.x) / shoulderWidth;
    const kneesBent = frontKneeAngle <= 138 && backKneeAngle <= 158;
    const splitStance = ankleSpread >= 0.72;
    const standing =
      leftKneeAngle >= 145 &&
      rightKneeAngle >= 145 &&
      Math.abs(landmarks[leftAnkle].x - landmarks[rightAnkle].x) / shoulderWidth <= 1.1 &&
      hipMid.y > shoulderMid.y;

    if (torsoFromVertical > 42) {
      return createResult('middle', 'Keep your chest tall over your hips.', 'Chest tall', 0.55);
    }
    if (!splitStance && !standing) {
      return createResult('middle', 'Step one foot forward into a split stance.', 'Split stance', 0.58);
    }
    if (frontKneeOverAnkle > 1.15) {
      return createResult('middle', 'Keep your front knee stacked over your ankle.', 'Front knee aligned', 0.6);
    }
    if (splitStance && kneesBent && kneeHeightGap <= 0.24) {
      return createResult('bottom', 'Strong lunge depth. Drive through the front foot.', undefined, 0.9);
    }
    if (standing) {
      return createResult('top', 'Stand tall before the next lunge.', undefined, 0.88);
    }
    return createResult('middle', 'Lower until both knees bend with control.', undefined, 0.72);
  },
};

export const evaluatePosture = (exerciseName: string, landmarks: Landmark[]): PostureResult => {
  if (!landmarks || landmarks.length < 33) {
    return { position: 'unknown', feedback: 'Position full body in frame...', isStatic: true, confidence: 0 };
  }

  const normalizedName = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = Object.keys(rulesMap).find(k => normalizedName.includes(k));
  
  if (key) return rulesMap[key](landmarks);
  
  return { 
    position: 'unknown', 
    feedback: 'Tap button to log progress.', 
    isStatic: true,
    confidence: 0,
  };
};
