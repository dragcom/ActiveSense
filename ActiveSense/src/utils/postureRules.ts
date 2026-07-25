export interface PostureResult {
  position: 'top' | 'middle' | 'bottom' | 'unknown';
  feedback: string;
  warning?: string;
  isStatic?: boolean;
  confidence: number;
}

export type ExerciseType =
  | 'squat'
  | 'sit_to_stand'
  | 'calf_raise'
  | 'side_leg_raise'
  | 'march'
  | 'torso_twist'
  | 'side_bend'
  | 'overhead_reach'
  | 'single_leg_stand'
  | 'quad_stretch'
  | 'triceps_stretch';

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
  leftHeel: 29,
  leftFootIndex: 30,
  rightHeel: 31,
  rightFootIndex: 32,
};

// Lowered visibility threshold slightly (0.20) to prevent dropouts on partial camera framing
const visible = (landmark?: Landmark) => (landmark?.visibility ?? 1) > 0.20;

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

const upperBodyRequired = [
  indexes.leftShoulder,
  indexes.rightShoulder,
  indexes.leftElbow,
  indexes.rightElbow,
  indexes.leftWrist,
  indexes.rightWrist,
];

const rulesMap: Record<string, (landmarks: Landmark[]) => PostureResult> = {
  // 1a. Bodyweight Squats (Forgiving thresholds)
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

    const torsoFromVertical = Math.abs(90 - lineAngle(shoulderMid, hipMid));
    const stanceWidth = distance(landmarks[leftAnkle], landmarks[rightAnkle]) / shoulderWidth;

    // Warning is advisory only — doesn't block rep detection
    let warning: string | undefined;
    if (torsoFromVertical > 50) warning = 'Keep chest open';

    // Relaxed bottom: 142 deg knee bend is enough for a rep (allows partial squats)
    if (kneeAngle <= 142) {
      return createResult('bottom', 'Good depth! Push back up.', warning, 0.88);
    }
    // Relaxed top: Stand up to 148+ deg (doesn't require 100% leg lock)
    if (kneeAngle >= 148) {
      return createResult('top', 'Ready for the next rep.', warning, 0.86);
    }
    return createResult('middle', 'Lower with control...', warning, 0.72);
  },

  // 1b. Sit-to-Stand
  'sit_to_stand': (landmarks) => {
    const { leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Ensure full body and chair are in frame.', undefined, 0);
    }

    const kneeAngle = averageVisibleAngles(landmarks, [
      [leftHip, leftKnee, leftAnkle],
      [rightHip, rightKnee, rightAnkle],
    ]) ?? 180;

    // Bottom (seated): Knee angle <= 130 deg
    if (kneeAngle <= 130) {
      return createResult('bottom', 'Seated position. Press through heels to stand.', undefined, 0.88);
    }
    // Top (standing): Knee angle >= 145 deg
    if (kneeAngle >= 145) {
      return createResult('top', 'Standing tall. Lower back down safely.', undefined, 0.86);
    }
    return createResult('middle', 'Transitioning smoothly.', undefined, 0.72);
  },

  // 2. Standing Calf Raises
  'calf_raise': (landmarks) => {
    const { leftAnkle, rightAnkle, leftHeel, rightHeel, leftFootIndex, rightFootIndex } = indexes;
    const feetLandmarks = [leftAnkle, rightAnkle, leftHeel, rightHeel, leftFootIndex, rightFootIndex];

    if (feetLandmarks.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Keep feet and ankles in frame.', undefined, 0);
    }

    const leftHeelElevation = landmarks[leftFootIndex].y - landmarks[leftHeel].y;
    const rightHeelElevation = landmarks[rightFootIndex].y - landmarks[rightHeel].y;
    const maxHeelElevation = Math.max(leftHeelElevation, rightHeelElevation);

    // Reduced elevation needed: 0.018 offset registers as toe press
    if (maxHeelElevation > 0.018) {
      return createResult('bottom', 'Nice lift! Lower slowly.', undefined, 0.86);
    }
    if (maxHeelElevation <= 0.012) {
      return createResult('top', 'Heels down. Rise onto toes.', undefined, 0.84);
    }
    return createResult('middle', 'Lifting up...', undefined, 0.72);
  },

  // 3. Side Leg Raises
  'side_leg_raise': (landmarks) => {
    const { leftShoulder, rightShoulder, leftAnkle, rightAnkle } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Stand facing camera with legs visible.', undefined, 0);
    }

    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const ankleSpread = Math.abs(landmarks[leftAnkle].x - landmarks[rightAnkle].x) / shoulderWidth;

    // Reduced spread ratio required from 1.1 to 0.98
    if (ankleSpread > 0.98) {
      return createResult('bottom', 'Leg raised! Return to center.', undefined, 0.84);
    }
    if (ankleSpread < 0.90) {
      return createResult('top', 'Feet together. Lift leg outward.', undefined, 0.84);
    }
    return createResult('middle', 'Lifting leg outward...', undefined, 0.72);
  },

  // 4. Standing High-Knee Marching
  'march': (landmarks) => {
    const { leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee } = indexes;
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Stand where knees and hips are visible.', undefined, 0);
    }

    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const leftKneeLift = (landmarks[leftHip].y - landmarks[leftKnee].y) / shoulderWidth;
    const rightKneeLift = (landmarks[rightHip].y - landmarks[rightKnee].y) / shoulderWidth;

    // Moderate knee lift (-0.33 threshold) registers rep easily
    if (Math.max(leftKneeLift, rightKneeLift) > -0.33) {
      return createResult('bottom', 'Great knee lift! Switch legs.', undefined, 0.84);
    }
    if (leftKneeLift < -0.38 && rightKneeLift < -0.38) {
      return createResult('top', 'Feet down. March alternating knees.', undefined, 0.78);
    }
    return createResult('middle', 'Marching...', undefined, 0.7);
  },

  // 5. Standing Torso Twists
  'torso_twist': (landmarks) => {
    const { leftShoulder, rightShoulder, leftHip, rightHip } = indexes;
    if ([leftShoulder, rightShoulder, leftHip, rightHip].some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Position upper body clearly in frame.', undefined, 0);
    }

    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const hipWidth = Math.max(0.001, distance(landmarks[leftHip], landmarks[rightHip]));
    const apparentWidthRatio = shoulderWidth / hipWidth;
    const shoulderZDiff = Math.abs((landmarks[leftShoulder].z ?? 0) - (landmarks[rightShoulder].z ?? 0));

    // Slight rotation (ratio < 0.80 or mild Z-depth offset) triggers peak twist
    if (apparentWidthRatio < 0.80 || shoulderZDiff > 0.08) {
      return createResult('bottom', 'Twist complete! Rotate back to center.', undefined, 0.85);
    }
    if (apparentWidthRatio >= 0.88) {
      return createResult('top', 'Facing forward. Begin twist.', undefined, 0.82);
    }
    return createResult('middle', 'Twisting through core...', undefined, 0.72);
  },

  // 6. Standing Side Bends
  'side_bend': (landmarks) => {
    const { leftShoulder, rightShoulder } = indexes;
    if (!visible(landmarks[leftShoulder]) || !visible(landmarks[rightShoulder])) {
      return createResult('unknown', 'Keep shoulders visible in frame.', undefined, 0);
    }

    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));
    const shoulderTilt = Math.abs(landmarks[leftShoulder].y - landmarks[rightShoulder].y) / shoulderWidth;

    // Gentle side tilt (> 0.14) registers the bend
    if (shoulderTilt > 0.14) {
      return createResult('bottom', 'Side bend reached! Return upright.', undefined, 0.85);
    }
    if (shoulderTilt < 0.08) {
      return createResult('top', 'Standing upright. Bend to side.', undefined, 0.83);
    }
    return createResult('middle', 'Bending to side...', undefined, 0.72);
  },

  // 7. Overhead Reaches
  'overhead_reach': (landmarks) => {
    if (upperBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createResult('unknown', 'Keep shoulders, elbows, and wrists in frame.', undefined, 0);
    }

    const { leftShoulder, rightShoulder, leftWrist, rightWrist } = indexes;
    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));

    const leftReach = (landmarks[leftShoulder].y - landmarks[leftWrist].y) / shoulderWidth;
    const rightReach = (landmarks[rightShoulder].y - landmarks[rightWrist].y) / shoulderWidth;
    const maxReach = Math.max(leftReach, rightReach);

    // Hands slightly above shoulders (> 0.18) triggers top reach
    if (maxReach > 0.18) {
      return createResult('bottom', 'Arms reached overhead! Lower down.', undefined, 0.88);
    }
    if (maxReach < 0.08) {
      return createResult('top', 'Hands down. Reach toward ceiling.', undefined, 0.84);
    }
    return createResult('middle', 'Reaching upward...', undefined, 0.72);
  },

  // Static Holds (Forgiving balance / position detection)
  'single_leg_stand': (landmarks) => {
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createStaticResult('Step back so full body is visible.', undefined, 0);
    }

    const { leftAnkle, rightAnkle, leftKnee, rightKnee, leftHip, rightHip, leftShoulder, rightShoulder } = indexes;
    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));

    const ankleVerticalDiff = Math.abs(landmarks[leftAnkle].y - landmarks[rightAnkle].y) / shoulderWidth;
    const leftKneeAngle = calculateAngle(landmarks[leftHip], landmarks[leftKnee], landmarks[leftAnkle]);
    const rightKneeAngle = calculateAngle(landmarks[rightHip], landmarks[rightKnee], landmarks[rightAnkle]);

    const isLiftingLeg = ankleVerticalDiff > 0.08 || leftKneeAngle < 160 || rightKneeAngle < 160;

    if (isLiftingLeg) {
      return createStaticResult('Good balance! Hold steady.', undefined, 0.90);
    }
    return createStaticResult('Lift one foot slightly off the ground.', 'Lift one foot', 0.75);
  },

  'quad_stretch': (landmarks) => {
    if (fullBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createStaticResult('Step back so full body is visible.', undefined, 0);
    }

    const { leftHip, leftKnee, leftAnkle, rightHip, rightKnee, rightAnkle } = indexes;
    const leftKneeAngle = calculateAngle(landmarks[leftHip], landmarks[leftKnee], landmarks[leftAnkle]);
    const rightKneeAngle = calculateAngle(landmarks[rightHip], landmarks[rightKnee], landmarks[rightAnkle]);

    if (leftKneeAngle < 110 || rightKneeAngle < 110) {
      return createStaticResult('Holding quad stretch!', undefined, 0.88);
    }
    return createStaticResult('Pull heel back toward glutes.', 'Bend knee', 0.75);
  },

  'triceps_stretch': (landmarks) => {
    if (upperBodyRequired.some((i) => !visible(landmarks[i]))) {
      return createStaticResult('Keep upper body in frame.', undefined, 0);
    }

    const { leftShoulder, rightShoulder, leftElbow, rightElbow } = indexes;
    const shoulderWidth = Math.max(0.001, distance(landmarks[leftShoulder], landmarks[rightShoulder]));

    const leftElbowUp = (landmarks[leftShoulder].y - landmarks[leftElbow].y) / shoulderWidth > 0.05;
    const rightElbowUp = (landmarks[rightShoulder].y - landmarks[rightElbow].y) / shoulderWidth > 0.05;

    if (leftElbowUp || rightElbowUp) {
      return createStaticResult('Holding triceps stretch!', undefined, 0.86);
    }
    return createStaticResult('Raise elbow overhead to stretch.', 'Raise elbow', 0.75);
  },
};

export const evaluatePosture = (exerciseName: string, landmarks: Landmark[]): PostureResult => {
  if (!landmarks || landmarks.length < 33) {
    return { position: 'unknown', feedback: 'Position full body in frame...', isStatic: true, confidence: 0 };
  }

  const normalizedName = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = Object.keys(rulesMap).find((k) => normalizedName.includes(k.replace(/[^a-z0-9]/g, '')));

  if (key) return rulesMap[key](landmarks);

  return {
    position: 'unknown',
    feedback: 'Tap button to log progress.',
    isStatic: true,
    confidence: 0,
  };
};