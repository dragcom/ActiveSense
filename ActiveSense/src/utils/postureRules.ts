export interface PostureResult {
  position: 'top' | 'middle' | 'bottom' | 'unknown';
  feedback: string;
  warning?: string;
  isStatic?: boolean;
}

export const calculateAngle = (pA: any, pB: any, pC: any) => {
  let radians = Math.atan2(pC.y - pB.y, pC.x - pB.x) - Math.atan2(pA.y - pB.y, pA.x - pB.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return angle;
};

const createResult = (
  position: 'top' | 'middle' | 'bottom' | 'unknown', 
  feedback: string, 
  warning?: string
): PostureResult => ({
  position,
  feedback,
  warning,
  isStatic: false
});

const staticResult = (feedback: string): PostureResult => ({
  position: 'unknown',
  feedback,
  isStatic: true
});

const rulesMap: Record<string, (landmarks: any[]) => PostureResult> = {
  'squat': (landmarks) => {
    const hip = landmarks[24]; const knee = landmarks[26]; const ankle = landmarks[28];
    const angle = calculateAngle(hip, knee, ankle);
    if (knee.x < hip.x - 0.05) return createResult('middle', 'Watch your knees!', 'Push your knees outward');
    if (angle <= 100) return createResult('bottom', 'Great depth! Drive up!');
    if (angle >= 160) return createResult('top', 'Squeeze glutes at the top.');
    return createResult('middle', 'Lower down slowly...');
  },
  'push': (landmarks) => {
    const shoulder = landmarks[12]; const elbow = landmarks[14]; const wrist = landmarks[16];
    const angle = calculateAngle(shoulder, elbow, wrist);
    if (shoulder.y < elbow.y - 0.1) return createResult('middle', 'Keep elbows aligned', 'Raise your elbows');
    if (angle < 90) return createResult('bottom', 'Good depth, push away!');
    if (angle > 150) return createResult('top', 'Arms extended.');
    return createResult('middle', 'Keep your core tight.');
  },
  'march': (landmarks) => {
    const hip = landmarks[24]; const leftKnee = landmarks[25]; const rightKnee = landmarks[26];
    if (leftKnee.y < hip.y + 0.05 || rightKnee.y < hip.y + 0.05) return createResult('top', 'High knees!');
    if (leftKnee.y > hip.y + 0.2 && rightKnee.y > hip.y + 0.2) return createResult('bottom', 'Keep marching.');
    return createResult('middle', 'Drive those knees up.');
  },
  'step': (landmarks) => {
    const leftAnkle = landmarks[27]; const rightAnkle = landmarks[28];
    const distance = Math.abs(leftAnkle.x - rightAnkle.x);
    if (distance > 0.3) return createResult('top', 'Good wide step!');
    if (distance < 0.15) return createResult('bottom', 'Feet together.');
    return createResult('middle', 'Step out...');
  },
  'raise': (landmarks) => {
    const shoulder = landmarks[12]; const wrist = landmarks[16];
    if (wrist.y < shoulder.y) return createResult('top', 'Arms high!');
    if (wrist.y > shoulder.y + 0.3) return createResult('bottom', 'Reset arms.');
    return createResult('middle', 'Lift smoothly...');
  },
  'morning': (landmarks) => {
    const shoulder = landmarks[12]; const hip = landmarks[24]; const knee = landmarks[26];
    const angle = calculateAngle(shoulder, hip, knee);
    if (angle < 120) return createResult('bottom', 'Good hinge, feel the stretch.');
    if (angle > 165) return createResult('top', 'Stand tall.');
    return createResult('middle', 'Hinge at the hips.');
  },
  'row': (landmarks) => {
    const shoulder = landmarks[12]; const elbow = landmarks[14]; const wrist = landmarks[16];
    const angle = calculateAngle(shoulder, elbow, wrist);
    if (angle < 90) return createResult('top', 'Squeeze shoulder blades!');
    if (angle > 150) return createResult('bottom', 'Full reach forward.');
    return createResult('middle', 'Pull smoothly.');
  },
  
  'breathing_reset': () => staticResult('Focus on your breath.'),
  'standing_forward_fold': (l) => rulesMap['morning'](l),
  'seated_twist': () => staticResult('Rotate slowly and breathe.'),
  'seated_marches': (l) => rulesMap['march'](l),
  'chair_arm_raises': (l) => rulesMap['raise'](l),
  'ankle_circles': () => staticResult('Move ankles smoothly.'),
  'walk_in_place': (l) => rulesMap['march'](l),
  'side_steps': (l) => rulesMap['step'](l),
  'heel_digs': (l) => rulesMap['step'](l),
  'arm_circles': (l) => rulesMap['raise'](l),
  'leg_raises': (l) => rulesMap['raise'](l),
  'cool_down_stretch': () => staticResult('Relax and cool down.'),
  'tandem_stand': () => staticResult('Focus on your balance.'),
  'side_leg_lifts': (l) => rulesMap['raise'](l),
  'heel_to_toe_walk': () => staticResult('Move with control.'),
  'low_jacks': (l) => rulesMap['step'](l),
  'fast_marches': (l) => rulesMap['march'](l),
  'squat_reach': (l) => rulesMap['squat'](l),
  'neck_release': () => staticResult('Move gently.'),
  'hamstring_stretch': (l) => rulesMap['morning'](l),
  'child_pose_breathing': () => staticResult('Let breath soften your back.')
};

export const evaluatePosture = (exerciseName: string, landmarks: any[]): PostureResult => {
  if (!landmarks || landmarks.length < 33) {
    return { position: 'unknown', feedback: 'Position full body in frame...', isStatic: true };
  }

  const normalizedName = exerciseName.toLowerCase().replace(/ /g, '_');
  const key = Object.keys(rulesMap).find(k => normalizedName.includes(k));
  
  if (key) return rulesMap[key](landmarks);
  
  return { 
    position: 'unknown', 
    feedback: 'Tap button to log progress.', 
    isStatic: true 
  };
};