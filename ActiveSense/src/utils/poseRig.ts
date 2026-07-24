import { PoseLandmark } from '../types';

// BoneMap stores the humanoid bones we know how to animate from pose landmarks.
export type BoneMap = {
  hips?: any;
  spine?: any;
  head?: any;
  leftShoulder?: any;
  leftUpperArm?: any;
  leftLowerArm?: any;
  rightShoulder?: any;
  rightUpperArm?: any;
  rightLowerArm?: any;
  leftUpperLeg?: any;
  leftLowerLeg?: any;
  rightUpperLeg?: any;
  rightLowerLeg?: any;
};

// RestPose keeps each bone's original rotation and segment direction for retargeting.
type RestBonePose = {
  quaternion: any;
  segmentDirection?: any;
};
export type RestPose = Record<string, RestBonePose>;

export type PoseRigState = {
  filteredLandmarks?: PoseLandmark[];
  lastStandingRootY?: number;
};

type AvatarSide = 'left' | 'right';
type PoseRigOptions = {
  mirrored?: boolean;
};

// MediaPipe's standard pose connections define the original 33-point skeleton drawing.
export const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
] as const;

// Named indexes make MediaPipe's numeric landmark positions readable in the rig code.
export const poseIndexes = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
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

// Clamp normalized camera coordinates so drawing never escapes the preview bounds.
export const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

// MediaPipe visibility may be absent, so missing visibility is treated as confident.
export const getVisibility = (landmark?: PoseLandmark) => landmark?.visibility ?? 1;

// This helper keeps visibility checks consistent between avatar and skeleton overlays.
export const isLandmarkVisible = (landmark?: PoseLandmark, threshold = 0.25) =>
  getVisibility(landmark) > threshold;

// Full-body avatar control needs shoulders and hips, not just any 33 points.
export const hasFullBodyPose = (landmarks: PoseLandmark[]) => {
  if (landmarks.length !== 33) {
    return false;
  }
  const { leftShoulder, rightShoulder, leftHip, rightHip } = poseIndexes;
  return [leftShoulder, rightShoulder, leftHip, rightHip].every((index) =>
    isLandmarkVisible(landmarks[index]),
  );
};

// Partial camera views should still animate any visible body regions.
export const hasTrackablePose = (landmarks: PoseLandmark[]) => {
  if (landmarks.length !== 33) {
    return false;
  }
  return Object.values(poseIndexes).some((index) => isLandmarkVisible(landmarks[index], 0.2));
};

const landmarkDistance = (a: PoseLandmark, b: PoseLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

const jointAngle2d = (a: PoseLandmark, b: PoseLandmark, c: PoseLandmark) => {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) {
    return 180;
  }
  return Math.acos(clamp(dot / mag, -1, 1)) * (180 / Math.PI);
};

const smoothLandmarks = (state: PoseRigState | undefined, landmarks: PoseLandmark[]) => {
  if (!state || landmarks.length !== 33) {
    return landmarks;
  }
  if (!state.filteredLandmarks || state.filteredLandmarks.length !== landmarks.length) {
    state.filteredLandmarks = landmarks.map((landmark) => ({ ...landmark }));
    return state.filteredLandmarks;
  }

  state.filteredLandmarks = landmarks.map((landmark, index) => {
    const previous = state.filteredLandmarks?.[index] ?? landmark;
    const confidence = getVisibility(landmark);
    const jump = landmarkDistance(previous, landmark);
    if (confidence < 0.2 && jump > 0.04) {
      return previous;
    }
    const blend = jump > 0.18 ? 0.06 : jump > 0.09 ? 0.1 : 0.18;
    return {
      x: previous.x + (landmark.x - previous.x) * blend,
      y: previous.y + (landmark.y - previous.y) * blend,
      z: (previous.z ?? landmark.z ?? 0) + ((landmark.z ?? previous.z ?? 0) - (previous.z ?? landmark.z ?? 0)) * blend,
      visibility: confidence,
    };
  });
  return state.filteredLandmarks;
};

// Search the loaded GLB for a bone whose normalized name matches known humanoid patterns.
const findBone = (root: any, patterns: string[]) => {
  let match: any;
  root.traverse((object: any) => {
    if (match || !object.isBone) {
      return;
    }
    const normalized = object.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (patterns.some((pattern) => normalized.includes(pattern))) {
      match = object;
    }
  });
  return match;
};

// Map Mixamo-style GLB bones to semantic body parts used by the retargeting code.
export const mapBones = (root: any): BoneMap => ({
  hips: findBone(root, ['mixamorighips', 'hips']),
  spine: findBone(root, ['mixamorigspine2', 'mixamorigspine1', 'spine', 'chest']),
  head: findBone(root, ['mixamorighead', 'head', 'neck']),
  leftShoulder: findBone(root, ['mixamorigleftshoulder', 'leftshoulder', 'shoulder_l', 'lshoulder']),
  leftUpperArm: findBone(root, ['mixamorigleftarm', 'leftupperarm', 'leftarm', 'upperarm_l', 'lupperarm']),
  leftLowerArm: findBone(root, ['mixamorigleftforearm', 'leftforearm', 'leftlowerarm', 'forearm_l', 'llowerarm']),
  rightShoulder: findBone(root, ['mixamorigrightshoulder', 'rightshoulder', 'shoulder_r', 'rshoulder']),
  rightUpperArm: findBone(root, ['mixamorigrightarm', 'rightupperarm', 'rightarm', 'upperarm_r', 'rupperarm']),
  rightLowerArm: findBone(root, ['mixamorigrightforearm', 'rightforearm', 'rightlowerarm', 'forearm_r', 'rlowerarm']),
  leftUpperLeg: findBone(root, ['mixamorigleftupleg', 'leftupleg', 'leftupperleg', 'leftthigh', 'thigh_l', 'lupperleg']),
  leftLowerLeg: findBone(root, ['mixamorigleftleg', 'leftleg', 'leftlowerleg', 'leftshin', 'shin_l', 'llowerleg']),
  rightUpperLeg: findBone(root, ['mixamorigrightupleg', 'rightupleg', 'rightupperleg', 'rightthigh', 'thigh_r', 'rupperleg']),
  rightLowerLeg: findBone(root, ['mixamorigrightleg', 'rightleg', 'rightlowerleg', 'rightshin', 'shin_r', 'rlowerleg']),
});

// A quick count is useful for status text and fallback decisions.
export const countMappedBones = (bones: BoneMap) => Object.values(bones).filter(Boolean).length;

const firstBoneChild = (bone: any) => bone?.children?.find((child: any) => child.isBone);

// Capture the avatar's neutral pose after loading the GLB.
export const captureRestPose = (bones: BoneMap): RestPose => {
  const rest: RestPose = {};
  Object.entries(bones).forEach(([key, bone]) => {
    if (bone?.quaternion) {
      const child = firstBoneChild(bone);
      rest[key] = {
        quaternion: bone.quaternion.clone(),
        segmentDirection: child?.position?.clone?.().normalize?.(),
      };
    }
  });
  return rest;
};

// Ease every mapped bone back toward its original rotation when tracking is unreliable.
export const resetAvatarPose = (bones: BoneMap, rest: RestPose) => {
  Object.entries(bones).forEach(([key, bone]) => {
    if (bone?.quaternion && rest[key]?.quaternion) {
      bone.quaternion.slerp(rest[key].quaternion, 0.2);
    }
  });
};

// Keep pose-driven rotations inside a comfortable range for the avatar.
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Apply a small rotation on top of a bone's rest pose and smooth the transition.
const applyAdditiveRotation = (
  THREE: any,
  rest: RestPose,
  key: keyof BoneMap,
  bone: any,
  rotation: { x?: number; y?: number; z?: number },
  smoothing = 0.35,
) => {
  if (!bone || !rest[key]?.quaternion) {
    return;
  }
  const delta = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0, 'XYZ'),
  );
  const target = rest[key].quaternion.clone().multiply(delta);
  bone.quaternion.slerp(target, smoothing);
  bone.updateMatrixWorld?.(true);
};

const rotate2d = (vector: { x: number; y: number }, radians: number) => {
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
};

const rotateXZ = (vector: { x: number; z: number }, radians: number) => {
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  return {
    x: vector.x * cos + vector.z * sin,
    z: -vector.x * sin + vector.z * cos,
  };
};

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const range = edge1 - edge0;
  const t = clamp((value - edge0) / (Math.abs(range) < 0.0001 ? 0.0001 : range), 0, 1);
  return t * t * (3 - 2 * t);
};

const bodyLocalVector = (
  from: PoseLandmark,
  to: PoseLandmark,
  rootRotationZ: number,
) => rotate2d(
  {
    x: to.x - from.x,
    // MediaPipe y grows downward; Three.js y grows upward.
    y: from.y - to.y,
  },
  -rootRotationZ,
);

const bodyLocalVector3 = (
  from: PoseLandmark,
  to: PoseLandmark,
  rootRotationZ: number,
  rootRotationY: number,
  depthMode: 'none' | 'signed' | 'forwardOnly' = 'none',
) => {
  const flat = bodyLocalVector(from, to, rootRotationZ);
  const projectedLength = Math.hypot(flat.x, flat.y);
  // MediaPipe z gets smaller as a landmark moves toward the camera; Three.js +z points toward the viewer here.
  const depthDelta = ((to.z ?? 0) - (from.z ?? 0)) * -1;
  const isBunchedForwardSegment =
    depthMode === 'forwardOnly' &&
    projectedLength < 0.052 &&
    Math.abs(depthDelta) > 0.045;
  const collapsedProjection = isBunchedForwardSegment ? smoothstep(0.052, 0.022, projectedLength) : 0;
  const depth =
    depthMode === 'none'
      ? 0
      : depthMode === 'forwardOnly'
        ? Math.abs(depthDelta) * collapsedProjection
        : depthDelta * collapsedProjection;
  const withDepth = {
    x: flat.x,
    y: flat.y,
    z: clamp(depth, depthMode === 'forwardOnly' ? 0 : -0.42, 0.42),
  };
  const yawLocal = rotateXZ({ x: withDepth.x, z: withDepth.z }, -rootRotationY);
  return { x: yawLocal.x, y: withDepth.y, z: yawLocal.z };
};

const bodyLocalDirection = (
  THREE: any,
  from: PoseLandmark,
  to: PoseLandmark,
  rootRotationZ: number,
  rootRotationY: number,
  depthMode?: 'none' | 'signed' | 'forwardOnly',
  preventBehindBody = false,
  avatarSide?: AvatarSide,
) => {
  const vector = bodyLocalVector3(from, to, rootRotationZ, rootRotationY, depthMode);
  if (preventBehindBody) {
    vector.z = Math.max(0, vector.z);
  }
  if (avatarSide === 'left') {
    vector.x = Math.max(0.035, vector.x);
  }
  if (avatarSide === 'right') {
    vector.x = Math.min(-0.035, vector.x);
  }
  const direction = new THREE.Vector3(vector.x, vector.y, vector.z);
  if (direction.lengthSq() < 0.000001) {
    return null;
  }
  return direction.normalize();
};

const applySegmentRotation = (
  THREE: any,
  root: any,
  rest: RestPose,
  key: keyof BoneMap,
  bone: any,
  targetDirectionRoot: any,
  smoothing = 0.4,
) => {
  const restPose = rest[key];
  if (!bone || !bone.parent || !restPose?.quaternion || !restPose.segmentDirection || !targetDirectionRoot) {
    return;
  }

  const rootWorldQuaternion = new THREE.Quaternion();
  const parentWorldInverse = new THREE.Quaternion();
  root.getWorldQuaternion(rootWorldQuaternion);
  bone.parent.getWorldQuaternion(parentWorldInverse).invert();

  const targetParentDirection = targetDirectionRoot
    .clone()
    .applyQuaternion(rootWorldQuaternion)
    .applyQuaternion(parentWorldInverse)
    .normalize();
  const restParentDirection = restPose.segmentDirection
    .clone()
    .applyQuaternion(restPose.quaternion)
    .normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(restParentDirection, targetParentDirection);
  const target = delta.multiply(restPose.quaternion);
  bone.quaternion.slerp(target, smoothing);
  bone.updateMatrixWorld?.(true);
};

// Mirrored camera previews need flipped x coordinates so avatar joints line up on screen.
const toMirroredLandmarks = (landmarks: PoseLandmark[]) =>
  landmarks.map((landmark) => ({ ...landmark, x: 1 - clampUnit(landmark.x), y: clampUnit(landmark.y) }));

// Move and rotate the loaded avatar from the latest MediaPipe 33-point pose.
export const updateAvatarPose = (
  THREE: any,
  root: any,
  bones: BoneMap,
  rest: RestPose,
  landmarks: PoseLandmark[],
  state?: PoseRigState,
  options: PoseRigOptions = {},
) => {
  const stableLandmarks = smoothLandmarks(state, landmarks);

  if (!hasTrackablePose(stableLandmarks)) {
    resetAvatarPose(bones, rest);
    root.position.lerp(new THREE.Vector3(0, 0.02, 0), 0.08);
    root.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08);
    root.rotation.y += (0 - root.rotation.y) * 0.08;
    root.rotation.z += (0 - root.rotation.z) * 0.08;
    return false;
  }

  const mirrored = options.mirrored ?? true;
  const rigLandmarks = mirrored ? toMirroredLandmarks(stableLandmarks) : stableLandmarks;
  const {
    nose,
    leftEye,
    rightEye,
    leftEar,
    rightEar,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
  } = poseIndexes;

  const centerOf = (indexes: number[]) => {
    const visible = indexes
      .map((index) => rigLandmarks[index])
      .filter((landmark) => isLandmarkVisible(landmark, 0.2));
    if (!visible.length) {
      return null;
    }
    return {
      x: visible.reduce((sum, landmark) => sum + landmark.x, 0) / visible.length,
      y: visible.reduce((sum, landmark) => sum + landmark.y, 0) / visible.length,
      z: visible.reduce((sum, landmark) => sum + (landmark.z ?? 0), 0) / visible.length,
    };
  };

  const shoulderCenter = centerOf([leftShoulder, rightShoulder]);
  const hipCenter = centerOf([leftHip, rightHip]);
  const faceCenter = centerOf([nose, leftEye, rightEye, leftEar, rightEar]);
  const visibleCenter = centerOf([
    nose,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
  ]);
  if (!visibleCenter) {
    resetAvatarPose(bones, rest);
    return false;
  }

  const hasShoulders =
    isLandmarkVisible(rigLandmarks[leftShoulder], 0.2) && isLandmarkVisible(rigLandmarks[rightShoulder], 0.2);
  const hasHips =
    isLandmarkVisible(rigLandmarks[leftHip], 0.2) && isLandmarkVisible(rigLandmarks[rightHip], 0.2);
  const hasSquatLegs = [
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
  ].every((index) => isLandmarkVisible(rigLandmarks[index], 0.25));
  const averageKneeAngle = hasSquatLegs
    ? (
        jointAngle2d(rigLandmarks[leftHip], rigLandmarks[leftKnee], rigLandmarks[leftAnkle]) +
        jointAngle2d(rigLandmarks[rightHip], rigLandmarks[rightKnee], rigLandmarks[rightAnkle])
      ) / 2
    : 180;
  const averageHipAngle = hasSquatLegs && hasShoulders
    ? (
        jointAngle2d(rigLandmarks[leftShoulder], rigLandmarks[leftHip], rigLandmarks[leftKnee]) +
        jointAngle2d(rigLandmarks[rightShoulder], rigLandmarks[rightHip], rigLandmarks[rightKnee])
      ) / 2
    : 180;
  const isSquatDisplayPose = hasSquatLegs && averageKneeAngle < 132 && averageHipAngle < 125;

  // Translate and scale the avatar so it roughly follows the user in the camera frame.
  const shoulderWidth = hasShoulders
    ? Math.abs(rigLandmarks[leftShoulder].x - rigLandmarks[rightShoulder].x)
    : null;
  const bodyCenter = shoulderCenter && hipCenter
    ? {
        x: (shoulderCenter.x + hipCenter.x) / 2,
        y: (shoulderCenter.y + hipCenter.y) / 2,
      }
    : shoulderCenter
      ? { x: shoulderCenter.x, y: clampUnit(shoulderCenter.y + 0.16) }
      : hipCenter
        ? { x: hipCenter.x, y: clampUnit(hipCenter.y - 0.16) }
        : faceCenter
          ? { x: faceCenter.x, y: clampUnit(faceCenter.y + 0.28) }
          : visibleCenter;

  // Keep the avatar planted on screen. Camera/body drift should not drag the whole model around;
  // exercises such as squats should be shown through joint motion, not root translation.
  const targetRootX = clamp((bodyCenter.x - 0.5) * 0.35, -0.18, 0.18);
  const targetRootY = 0.02;
  if (!isSquatDisplayPose && state) {
    state.lastStandingRootY = targetRootY;
  }
  root.position.x += (targetRootX - root.position.x) * 0.04;
  root.position.y += (targetRootY - root.position.y) * 0.08;
  if (shoulderWidth !== null) {
    const targetScale = Math.max(0.62, Math.min(1, shoulderWidth * 3.4));
    root.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
  }

  // Torso and head use whatever core points are visible; limbs can still move without hips.
  const bodyAngle = shoulderCenter && hipCenter
    ? Math.atan2(shoulderCenter.x - hipCenter.x, hipCenter.y - shoulderCenter.y)
    : 0;
  const isFloorPose = shoulderCenter && hipCenter && Math.abs(bodyAngle) > 1.05;
  const mirroredBodyRoll = -bodyAngle;
  const bodyPlaneTilt = shoulderCenter && hipCenter ? clamp(mirroredBodyRoll, -1.35, 1.35) : 0;
  root.rotation.z += (bodyPlaneTilt - root.rotation.z) * 0.1;
  const rootTilt = root.rotation.z;
  const shoulderDepth = hasShoulders ? (rigLandmarks[rightShoulder].z ?? 0) - (rigLandmarks[leftShoulder].z ?? 0) : 0;
  const hipDepth = hasHips ? (rigLandmarks[rightHip].z ?? 0) - (rigLandmarks[leftHip].z ?? 0) : 0;
  const noseOffset = shoulderCenter && isLandmarkVisible(rigLandmarks[nose])
    ? rigLandmarks[nose].x - shoulderCenter.x
    : 0;
  // In mirror mode, turning one way should make the forward-facing avatar turn the opposite way.
  const bodyYaw = isFloorPose
    ? (bodyAngle >= 0 ? -1.05 : 1.05)
    : clamp((noseOffset * 2.4 + (shoulderDepth + hipDepth * 0.55) * -1.6) * -1, -0.9, 0.9);
  root.rotation.y += (bodyYaw - root.rotation.y) * 0.09;
  const rootYaw = root.rotation.y;
  const hipWidth = hasHips ? Math.max(0.001, Math.abs(rigLandmarks[leftHip].x - rigLandmarks[rightHip].x)) : 0;
  const squatDepth = shoulderWidth !== null && hipCenter && hipWidth
    ? isFloorPose
      ? 0
      : clamp((shoulderWidth / hipWidth - 1.15) * 0.55 + (0.52 - hipCenter.y), -0.25, 0.55)
    : 0;
  if (shoulderCenter && hipCenter) {
    applyAdditiveRotation(THREE, rest, 'hips', bones.hips, { x: squatDepth * 0.7, z: isFloorPose ? 0 : mirroredBodyRoll * 0.2 }, 0.16);
    applyAdditiveRotation(THREE, rest, 'spine', bones.spine, { x: squatDepth * -0.42, z: isFloorPose ? 0 : mirroredBodyRoll * 0.35 }, 0.16);
  }

  if (isLandmarkVisible(rigLandmarks[nose]) && (shoulderCenter || faceCenter)) {
    const headAnchor = shoulderCenter ?? faceCenter ?? rigLandmarks[nose];
    const eyeTilt = isLandmarkVisible(rigLandmarks[leftEye]) && isLandmarkVisible(rigLandmarks[rightEye])
      ? (rigLandmarks[rightEye].y - rigLandmarks[leftEye].y) * 2.8
      : 0;
    const earTilt = isLandmarkVisible(rigLandmarks[leftEar]) && isLandmarkVisible(rigLandmarks[rightEar])
      ? (rigLandmarks[rightEar].y - rigLandmarks[leftEar].y) * 2.1
      : 0;
    applyAdditiveRotation(
      THREE,
      rest,
      'head',
      bones.head,
      {
        y: clamp((rigLandmarks[nose].x - headAnchor.x) * 1.4, -0.35, 0.35),
        z: clamp(eyeTilt || earTilt, -0.55, 0.55),
      },
      0.16,
    );
  }

  root.updateMatrixWorld(true);

  const avatarLeftArm = mirrored
    ? {
        shoulder: rightShoulder,
        elbow: rightElbow,
        wrist: rightWrist,
      }
    : {
        shoulder: leftShoulder,
        elbow: leftElbow,
        wrist: leftWrist,
      };
  const avatarRightArm = mirrored
    ? {
        shoulder: leftShoulder,
        elbow: leftElbow,
        wrist: leftWrist,
      }
    : {
        shoulder: rightShoulder,
        elbow: rightElbow,
        wrist: rightWrist,
      };
  const avatarLeftLeg = mirrored
    ? {
        hip: rightHip,
        knee: rightKnee,
        ankle: rightAnkle,
      }
    : {
        hip: leftHip,
        knee: leftKnee,
        ankle: leftAnkle,
      };
  const avatarRightLeg = mirrored
    ? {
        hip: leftHip,
        knee: leftKnee,
        ankle: leftAnkle,
      }
    : {
        hip: rightHip,
        knee: rightKnee,
        ankle: rightAnkle,
      };

  if (isLandmarkVisible(rigLandmarks[avatarLeftArm.shoulder]) && isLandmarkVisible(rigLandmarks[avatarLeftArm.elbow])) {
    const upperDirection = bodyLocalDirection(
      THREE,
      rigLandmarks[avatarLeftArm.shoulder],
      rigLandmarks[avatarLeftArm.elbow],
      rootTilt,
      rootYaw,
      'none',
      true,
      'left',
    );
    applySegmentRotation(THREE, root, rest, 'leftUpperArm', bones.leftUpperArm, upperDirection, 0.18);
  }
  if (isLandmarkVisible(rigLandmarks[avatarLeftArm.elbow]) && isLandmarkVisible(rigLandmarks[avatarLeftArm.wrist])) {
    const lowerDirection = bodyLocalDirection(
      THREE,
      rigLandmarks[avatarLeftArm.elbow],
      rigLandmarks[avatarLeftArm.wrist],
      rootTilt,
      rootYaw,
      'forwardOnly',
      true,
      'left',
    );
    applySegmentRotation(THREE, root, rest, 'leftLowerArm', bones.leftLowerArm, lowerDirection, 0.2);
  }
  if (isLandmarkVisible(rigLandmarks[avatarRightArm.shoulder]) && isLandmarkVisible(rigLandmarks[avatarRightArm.elbow])) {
    const upperDirection = bodyLocalDirection(
      THREE,
      rigLandmarks[avatarRightArm.shoulder],
      rigLandmarks[avatarRightArm.elbow],
      rootTilt,
      rootYaw,
      'none',
      true,
      'right',
    );
    applySegmentRotation(THREE, root, rest, 'rightUpperArm', bones.rightUpperArm, upperDirection, 0.18);
  }
  if (isLandmarkVisible(rigLandmarks[avatarRightArm.elbow]) && isLandmarkVisible(rigLandmarks[avatarRightArm.wrist])) {
    const lowerDirection = bodyLocalDirection(
      THREE,
      rigLandmarks[avatarRightArm.elbow],
      rigLandmarks[avatarRightArm.wrist],
      rootTilt,
      rootYaw,
      'forwardOnly',
      true,
      'right',
    );
    applySegmentRotation(THREE, root, rest, 'rightLowerArm', bones.rightLowerArm, lowerDirection, 0.2);
  }
  if (isLandmarkVisible(rigLandmarks[avatarLeftLeg.hip]) && isLandmarkVisible(rigLandmarks[avatarLeftLeg.knee])) {
    const thighDirection = bodyLocalDirection(
      THREE,
      rigLandmarks[avatarLeftLeg.hip],
      rigLandmarks[avatarLeftLeg.knee],
      rootTilt,
      rootYaw,
    );
    applySegmentRotation(THREE, root, rest, 'leftUpperLeg', bones.leftUpperLeg, thighDirection, 0.14);
  }
  if (isLandmarkVisible(rigLandmarks[avatarLeftLeg.knee]) && isLandmarkVisible(rigLandmarks[avatarLeftLeg.ankle])) {
    const shinDirection = bodyLocalDirection(
      THREE,
      rigLandmarks[avatarLeftLeg.knee],
      rigLandmarks[avatarLeftLeg.ankle],
      rootTilt,
      rootYaw,
    );
    applySegmentRotation(THREE, root, rest, 'leftLowerLeg', bones.leftLowerLeg, shinDirection, 0.14);
  }
  if (isLandmarkVisible(rigLandmarks[avatarRightLeg.hip]) && isLandmarkVisible(rigLandmarks[avatarRightLeg.knee])) {
    const thighDirection = bodyLocalDirection(
      THREE,
      rigLandmarks[avatarRightLeg.hip],
      rigLandmarks[avatarRightLeg.knee],
      rootTilt,
      rootYaw,
    );
    applySegmentRotation(THREE, root, rest, 'rightUpperLeg', bones.rightUpperLeg, thighDirection, 0.14);
  }
  if (isLandmarkVisible(rigLandmarks[avatarRightLeg.knee]) && isLandmarkVisible(rigLandmarks[avatarRightLeg.ankle])) {
    const shinDirection = bodyLocalDirection(
      THREE,
      rigLandmarks[avatarRightLeg.knee],
      rigLandmarks[avatarRightLeg.ankle],
      rootTilt,
      rootYaw,
    );
    applySegmentRotation(THREE, root, rest, 'rightLowerLeg', bones.rightLowerLeg, shinDirection, 0.14);
  }

  return true;
};
