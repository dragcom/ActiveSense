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
  if (!angles.length) return null;
  return angles.reduce((sum, value) => sum + value, 0) / angles.length;
};

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

const createStaticResult = (
  feedback: string,
  warning?: string,
  confidence = 1,
): PostureResult => ({
  position: 'unknown',
  feedback,
  warning,
  isStatic: true,
  confidence,
});

const fullBodyRequired = [
  indexes.leftShoulder,
  indexes.rightShoulder,
  indexes.leftHip,
  indexes.rightHip,
  indexes.leftKnee,
  indexes.rightKnee,
  indexes.leftAnkle,
  indexes.rightAnkle,
];

const rulesMap: Record<string, (landmarks: Landmark[]) => PostureResult> = {
  'squat': (landmarks) => {
    const { leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Step back so your full body is visible.', undefined, 0);
    }

    const shoulderMid = midpoint(landmarks[leftShoulder], landmarks[rightShoulder]);
    const hipMid = midpoint(landmarks[leftHip], landmarks[rightHip]);
    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));

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

    // Attach non-blocking warnings
    let warning: string | undefined;
    if (torsoFromVertical > 45) warning = 'Chest up';
    else if (stanceWidth < 0.4 || stanceWidth > 2.2) warning = 'Adjust stance';

    // Count reps with forgiving thresholds; keep form issues as non-blocking warnings.
    if (kneeAngle <= 130 || (kneeAngle <= 138 && hipAngle <= 135)) {
      return createResult('bottom', 'Good depth. Drive up.', warning, 0.88);
    }
    if (kneeAngle >= 145 && hipAngle >= 138) {
      return createResult('top', 'Stand tall and brace for the next rep.', warning, 0.86);
    }
    return createResult('middle', 'Lower with control, then stand tall.', warning, 0.72);
  },

  'pushup': (landmarks) => {
    const { leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist } = indexes;
    const upperBody = [leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist];
    if (upperBody.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Keep shoulders, elbows, and wrists in frame.', undefined, 0);
    }

    const leftElbowAngle = calculateAngle(landmarks[leftShoulder], landmarks[leftElbow], landmarks[leftWrist]);
    const rightElbowAngle = calculateAngle(landmarks[rightShoulder], landmarks[rightElbow], landmarks[rightWrist]);
    const minElbowAngle = Math.min(leftElbowAngle, rightElbowAngle);
    const maxElbowAngle = Math.max(leftElbowAngle, rightElbowAngle);

    if (minElbowAngle <= 115) {
      return createResult('bottom', 'Good push-up depth. Press away.', undefined, 0.86);
    }
    if (maxElbowAngle >= 140) {
      return createResult('top', 'Arms extended. Control the next descent.', undefined, 0.84);
    }
    return createResult('middle', 'Lower your chest with control.', undefined, 0.72);
  },

  'lunge': (landmarks) => {
    const { leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Step back so your full body is visible.', undefined, 0);
    }

    const leftKneeAngle = calculateAngle(landmarks[leftHip], landmarks[leftKnee], landmarks[leftAnkle]);
    const rightKneeAngle = calculateAngle(landmarks[rightHip], landmarks[rightKnee], landmarks[rightAnkle]);
    const minKneeAngle = Math.min(leftKneeAngle, rightKneeAngle);

    if (minKneeAngle <= 125) {
      return createResult('bottom', 'Good lunge depth. Drive through front foot.', undefined, 0.86);
    }
    if (leftKneeAngle >= 140 && rightKneeAngle >= 140) {
      return createResult('top', 'Stand tall before the next lunge.', undefined, 0.84);
    }
    return createResult('middle', 'Lower until both knees bend with control.', undefined, 0.72);
  },

  'sit_to_stand': (landmarks) => {
    const { leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Keep your chair and full body in frame.', undefined, 0);
    }

    const kneeAngle = averageVisibleAngles(landmarks, [
      [leftHip, leftKnee, leftAnkle],
      [rightHip, rightKnee, rightAnkle],
    ]) ?? 180;

    if (kneeAngle <= 130) {
      return createResult('bottom', 'Seated position found. Press to stand.', undefined, 0.86);
    }
    if (kneeAngle >= 145) {
      return createResult('top', 'Standing tall. Lower back to chair with control.', undefined, 0.86);
    }
    return createResult('middle', 'Move between seated and standing slowly.', undefined, 0.7);
  },

  'hip_extension': (landmarks) => {
    const { leftShoulder, rightShoulder, leftHip, rightHip, leftAnkle, rightAnkle } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Stand sideways so both legs are visible.', undefined, 0);
    }

    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const leftBackReach = (landmarks[leftHip].x - landmarks[leftAnkle].x) / shoulderWidth;
    const rightBackReach = (landmarks[rightAnkle].x - landmarks[rightHip].x) / shoulderWidth;
    const maxBackReach = Math.max(leftBackReach, rightBackReach);

    if (maxBackReach > 0.35) {
      return createResult('bottom', 'Good hip extension. Return slowly.', undefined, 0.84);
    }
    if (maxBackReach < 0.25) {
      return createResult('top', 'Feet together. Lift one straight leg backward.', undefined, 0.84);
    }
    return createResult('middle', 'Move one straight leg backward with control.', undefined, 0.7);
  },

  'side_leg_raise': (landmarks) => {
    const { leftShoulder, rightShoulder, leftAnkle, rightAnkle } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Stand facing camera so both legs are visible.', undefined, 0);
    }

    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const ankleSpread = Math.abs(landmarks[leftAnkle].x - landmarks[rightAnkle].x) / shoulderWidth;

    if (ankleSpread > 1.1) {
      return createResult('bottom', 'Good side leg raise. Lower slowly.', undefined, 0.84);
    }
    if (ankleSpread < 0.9) {
      return createResult('top', 'Feet together. Lift one leg out to side.', undefined, 0.84);
    }
    return createResult('middle', 'Lift sideways with control.', undefined, 0.72);
  },

  'march': (landmarks) => {
    const { leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Stand where knees and feet are visible.', undefined, 0);
    }

    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const leftKneeLift = (landmarks[leftHip].y - landmarks[leftKnee].y) / shoulderWidth;
    const rightKneeLift = (landmarks[rightHip].y - landmarks[rightKnee].y) / shoulderWidth;

    if (Math.max(leftKneeLift, rightKneeLift) > -0.28) {
      return createResult('bottom', 'Good knee lift. Keep marching.', undefined, 0.84);
    }
    if (leftKneeLift < -0.35 && rightKneeLift < -0.35) {
      return createResult('top', 'Lift one knee at a time.', undefined, 0.78);
    }
    return createResult('middle', 'March slowly with alternating knees.', undefined, 0.7);
  },

  // Static Holds / Stretches (Do not count dynamic reps)
  'single_leg_stand': () => createStaticResult('Hold balance on one leg.', undefined, 0.9),
  'quad_stretch': () => createStaticResult('Hold quadriceps stretch.', undefined, 0.88),
  'triceps_stretch': () => createStaticResult('Hold triceps stretch.', undefined, 0.86),
};

export const evaluatePosture = (exerciseName: string, landmarks: Landmark[]): PostureResult => {
  if (!landmarks || landmarks.length < 33) {
    return { position: 'unknown', feedback: 'Position full body in frame...', isStatic: true, confidence: 0 };
  }

  const normalizedName = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = Object.keys(rulesMap).find(k => normalizedName.includes(k.replace(/[^a-z0-9]/g, '')));

  if (key) return rulesMap[key](landmarks);

  return {
    position: 'unknown',
    feedback: 'Tap button to log progress.',
    isStatic: true,
    confidence: 0,
  };
};
