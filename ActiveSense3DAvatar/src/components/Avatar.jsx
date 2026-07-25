import { Suspense, useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useConfiguratorStore, pb } from "../store";
import { Asset } from "./Asset";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const LIVE_AVATAR_BASE_Y = 0;
const POSE_TIMEOUT_MS = 300;

const MP = {
  NOSE: 0,
  L_EYE_INNER: 1,  L_EYE: 2,        L_EYE_OUTER: 3,
  R_EYE_INNER: 4,  R_EYE: 5,        R_EYE_OUTER: 6,
  L_EAR: 7,        R_EAR: 8,
  MOUTH_LEFT: 9,      MOUTH_RIGHT: 10,
  L_SHOULDER: 11,    R_SHOULDER: 12,
  L_ELBOW: 13,        R_ELBOW: 14,
  L_WRIST: 15,        R_WRIST: 16,
  L_PINKY: 17,        L_INDEX: 18,        L_THUMB: 19,
  R_PINKY: 20,        R_INDEX: 21,        R_THUMB: 22,
  L_HIP: 23,          R_HIP: 24,
  L_KNEE: 25,         R_KNEE: 26,
  L_ANKLE: 27,        R_ANKLE: 28,
  L_HEEL: 29,         L_FOOT_INDEX: 30,
  R_HEEL: 31,         R_FOOT_INDEX: 32,
};

// Isolated Math Objects
const _vClampDir = new THREE.Vector3();
const _vClampRest = new THREE.Vector3();
const _vApplyDir = new THREE.Vector3();
const _vApplyRest = new THREE.Vector3();
const _vAngle1 = new THREE.Vector3();
const _vAngle2 = new THREE.Vector3();
const _vLegDir = new THREE.Vector3();
const _vOrientDir = new THREE.Vector3();
const _vSpineDir = new THREE.Vector3();
const _vTemp = new THREE.Vector3();
const _vTemp2 = new THREE.Vector3();

const _qTemp1 = new THREE.Quaternion();
const _qTemp2 = new THREE.Quaternion();
const _qTemp3 = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();

const BEND_AXIS_X = new THREE.Vector3(1, 0, 0);
const SQUAT_ACTIVE_THRESHOLD = 0.10;
const MAX_SQUAT_THIGH_PITCH_DEG = 22;
const MAX_SQUAT_KNEE_BEND_DEG = 72;
const KNEE_STRAIGHT_ANGLE_DEG = 168;
const KNEE_BEND_DEADZONE_DEG = 10;

const getRestDirection = (bone) => {
  if (!bone) return new THREE.Vector3(0, -1, 0);
  const child = bone.children.find((c) => c.isBone);
  if (!child) return new THREE.Vector3(0, -1, 0);
  return child.position.clone().normalize();
};

const getScreenY = (joint) => {
  const y = joint?.screenY ?? joint?.y;
  return typeof y === "number" && !isNaN(y) ? y : null;
};

const getScreenX = (joint) => {
  const x = joint?.screenX ?? joint?.x;
  return typeof x === "number" && !isNaN(x) ? x : null;
};

const getZ = (joint) => {
  return typeof joint?.z === "number" && !isNaN(joint.z) ? joint.z : 0;
};

const calculate3DAngle = (pA, pB, pC) => {
  if (!pA || !pB || !pC) return null;
  const az = getZ(pA);
  const bz = getZ(pB);
  const cz = getZ(pC);

  _vAngle1.set(pA.x - pB.x, -(pA.y - pB.y), -(az - bz));
  _vAngle2.set(pC.x - pB.x, -(pC.y - pB.y), -(cz - bz));

  const mag1 = _vAngle1.length();
  const mag2 = _vAngle2.length();
  if (mag1 * mag2 === 0) return null;

  const dot = _vAngle1.dot(_vAngle2);
  const cosAngle = THREE.MathUtils.clamp(dot / (mag1 * mag2), -1, 1);
  const angle = THREE.MathUtils.radToDeg(Math.acos(cosAngle));
  return isNaN(angle) ? null : angle;
};

export const Avatar = ({ ...props }) => {
  const group = useRef();
  const { camera } = useThree();

  const { scene, nodes } = useGLTF("/models/Armature.glb");
  const { animations } = useGLTF("/models/Poses.glb");
  const { actions, mixer } = useAnimations(animations, group);

  const customization = useConfiguratorStore((state) => state.customization);
  const skin = useConfiguratorStore((state) => state.skin);
  const pose = useConfiguratorStore((state) => state.pose);
  const setDownload = useConfiguratorStore((state) => state.setDownload);

  const latestJoints = useRef(null);
  const lastPoseTimestamp = useRef(0);
  const smoothedJoints = useRef(null);
  const calibrationRef = useRef(null);
  const squatAmountRef = useRef(0);
  const isSeatedRef = useRef(false);
  const frameCounter = useRef(0);
  const torsoVisibleRef = useRef(false);

  const kneeAngleLeftRef = useRef(180);
  const kneeAngleRightRef = useRef(180);

  const baseGroupPosition = useRef(new THREE.Vector3());
  const baseGroupRotation = useRef(new THREE.Euler());

  const liveGroupPosition = useRef(new THREE.Vector3(0, LIVE_AVATAR_BASE_Y, 0));
  const liveGroupRotation = useRef(new THREE.Euler(0, 0, 0));
  const turnTargetRef = useRef(0);

  const bonesRef = useRef({
    neck: null, head: null,
    leftShoulder: null, rightShoulder: null,
    leftArm: null, leftForeArm: null, rightArm: null, rightForeArm: null,
    leftHand: null, rightHand: null,
    spine: null, hips: null,
    leftUpLeg: null, leftLeg: null, rightUpLeg: null, rightLeg: null,
    leftFoot: null, rightFoot: null,
  });

  const smoothPose = useCallback((incoming, alpha = 0.35) => {
    if (!incoming) return null;
    if (!smoothedJoints.current || smoothedJoints.current.length !== incoming.length) {
      smoothedJoints.current = incoming.map((j) => ({
        ...j,
        screenX: getScreenX(j) ?? undefined,
        screenY: getScreenY(j) ?? undefined,
      }));
      return smoothedJoints.current;
    }

    for (let i = 0; i < incoming.length; i++) {
      const joint = incoming[i];
      const prev = smoothedJoints.current[i];
      const prevScreenX = getScreenX(prev);
      const currScreenX = getScreenX(joint);
      const prevScreenY = getScreenY(prev);
      const currScreenY = getScreenY(joint);

      prev.x = THREE.MathUtils.lerp(prev.x, joint.x, alpha);
      prev.y = THREE.MathUtils.lerp(prev.y, joint.y, alpha);
      prev.z = THREE.MathUtils.lerp(getZ(prev), getZ(joint), alpha);
      prev.screenX = currScreenX !== null && prevScreenX !== null
        ? THREE.MathUtils.lerp(prevScreenX, currScreenX, alpha)
        : currScreenX ?? undefined;
      prev.screenY = currScreenY !== null && prevScreenY !== null
        ? THREE.MathUtils.lerp(prevScreenY, currScreenY, alpha)
        : currScreenY ?? undefined;
      prev.visibility = joint.visibility ?? prev.visibility ?? 1;
    }

    return smoothedJoints.current;
  }, []);

  const isVisible = (id) => {
    const joint = latestJoints.current?.[id];
    if (!joint) return false;
    return joint.visibility === undefined || joint.visibility > 0.20;
  };

  const hasStableTorso = () => {
    const ids = [MP.L_SHOULDER, MP.R_SHOULDER, MP.L_HIP, MP.R_HIP];
    return ids.every((id) => {
      const joint = latestJoints.current?.[id];
      const screenX = getScreenX(joint);
      const screenY = getScreenY(joint);
      return (
        joint &&
        (joint.visibility === undefined || joint.visibility > 0.35) &&
        screenX !== null &&
        screenY !== null
      );
    });
  };

  useEffect(() => {
    const handlePose = (joints) => {
      latestJoints.current = smoothPose(joints);
      lastPoseTimestamp.current = performance.now();
    };

    window.receiveRNPose = handlePose;

    window.receiveRNMessage = (data) => {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (parsed?.type === "LIVE_POSE") {
        handlePose(parsed.joints);
      } else if (parsed?.type === "SET_SEATED_MODE") {
        isSeatedRef.current = Boolean(parsed.enabled);
      }
    };

    window.setSeatedMode = (enabled) => {
      isSeatedRef.current = Boolean(enabled);
    };

    window.resetAvatarCalibration = () => {
      calibrationRef.current = null;
      squatAmountRef.current = 0;
    };

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "WEBVIEW_READY" }));
    }

    return () => {
      delete window.receiveRNPose;
      delete window.receiveRNMessage;
      delete window.setSeatedMode;
      delete window.resetAvatarCalibration;
    };
  }, [smoothPose]);

  useEffect(() => {
    if (group.current) {
      baseGroupPosition.current.copy(group.current.position);
      baseGroupRotation.current.copy(group.current.rotation);
    }
  }, []);

  useEffect(() => {
    if (scene && nodes) {
      const getBone = (standardName, fallbacks = []) => {
        if (nodes[standardName]) return nodes[standardName];
        for (const fallback of fallbacks) {
          if (nodes[fallback]) return nodes[fallback];
        }
        let found = scene.getObjectByName(standardName);
        if (found) return found;
        for (const fallback of fallbacks) {
          found = scene.getObjectByName(fallback);
          if (found) return found;
        }

        let partialMatch = null;
        scene.traverse((child) => {
          if (
            child.isBone &&
            (child.name.toLowerCase().includes(standardName.toLowerCase().replace("mixamorig", "")) ||
              fallbacks.some((f) => child.name.toLowerCase().includes(f.toLowerCase())))
          ) {
            partialMatch = child;
          }
        });
        return partialMatch;
      };

      const storeBone = (key, bone) => {
        if (!bone) return null;
        if (!bone.userData.baseQuaternion) {
          bone.updateMatrixWorld(true);
          bone.userData.baseQuaternion = bone.quaternion.clone();
          bone.userData.baseWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion()).clone();
          bone.userData.baseDirection = getRestDirection(bone);
          bone.userData.basePosition = bone.position.clone();
        }
        bonesRef.current[key] = bone;
        return bone;
      };

      storeBone("leftShoulder", getBone("mixamorigLeftShoulder", ["LeftShoulder", "leftShoulder", "Clavicle_L"]));
      storeBone("rightShoulder", getBone("mixamorigRightShoulder", ["RightShoulder", "rightShoulder", "Clavicle_R"]));
      storeBone("leftArm", getBone("mixamorigLeftArm", ["LeftArm", "leftArm", "Arm_L"]));
      storeBone("leftForeArm", getBone("mixamorigLeftForeArm", ["LeftForeArm", "leftForeArm", "ForeArm_L"]));
      storeBone("rightArm", getBone("mixamorigRightArm", ["RightArm", "rightArm", "Arm_R"]));
      storeBone("rightForeArm", getBone("mixamorigRightForeArm", ["RightForeArm", "rightForeArm", "ForeArm_R"]));
      storeBone("spine", getBone("mixamorigSpine", ["Spine", "spine", "Spine1", "Spine2", "mixamorigSpine1"]));
      storeBone("hips", getBone("mixamorigHips", ["Hips", "hips", "Pelvis"]));
      storeBone("leftUpLeg", getBone("mixamorigLeftUpLeg", ["LeftUpLeg", "leftUpLeg", "Thigh_L", "mixamorig_LeftUpLeg"]));
      storeBone("leftLeg", getBone("mixamorigLeftLeg", ["LeftLeg", "leftLeg", "Shin_L", "mixamorig_LeftLeg"]));
      storeBone("rightUpLeg", getBone("mixamorigRightUpLeg", ["RightUpLeg", "rightUpLeg", "Thigh_R", "mixamorig_RightUpLeg"]));
      storeBone("rightLeg", getBone("mixamorigRightLeg", ["RightLeg", "rightLeg", "Shin_R", "mixamorig_RightLeg"]));
      storeBone("neck", getBone("mixamorigNeck", ["Neck", "neck", "Neck1", "mixamorigSpine2"]));
      storeBone("head", getBone("mixamorigHead", ["Head", "head", "mixamorigHeadTop_End"]));
      storeBone("leftHand", getBone("mixamorigLeftHand", ["LeftHand", "leftHand", "Hand_L"]));
      storeBone("rightHand", getBone("mixamorigRightHand", ["RightHand", "rightHand", "Hand_R"]));
      storeBone("leftFoot", getBone("mixamorigLeftFoot", ["LeftFoot", "leftFoot", "Foot_L", "LeftToeBase"]));
      storeBone("rightFoot", getBone("mixamorigRightFoot", ["RightFoot", "rightFoot", "Foot_R", "RightToeBase"]));
    }
  }, [scene, nodes]);

  const resetBoneToRest = (bone) => {
    if (!bone || !bone.userData.baseQuaternion) return;
    bone.quaternion.slerp(bone.userData.baseQuaternion, 0.12);
  };

  const resetBonePosition = (bone, speed = 0.12) => {
    if (!bone?.userData.basePosition) return;
    bone.position.lerp(bone.userData.basePosition, speed);
  };

  const applySquatBend = (bone, axis, angle, speed = 0.14) => {
    if (!bone?.userData.baseQuaternion || isNaN(angle)) return;
    _qTemp1.setFromAxisAngle(axis, angle);
    _qTemp2.copy(bone.userData.baseQuaternion).multiply(_qTemp1);
    bone.quaternion.slerp(_qTemp2, speed);
  };

  const applyBoneDirection = (bone, worldDir, speed = 0.25) => {
    if (!bone) return;
    if (!worldDir || worldDir.lengthSq() < 0.00001 || isNaN(worldDir.x)) {
      resetBoneToRest(bone);
      return;
    }

    _vApplyDir.copy(worldDir).normalize();
    if (bone.parent) {
      bone.parent.updateMatrixWorld(true);
      bone.parent.getWorldQuaternion(_parentQuat);
      _vApplyDir.applyQuaternion(_parentQuat.invert());
    }

    const restDir = bone.userData.baseDirection || _vApplyRest.set(0, -1, 0);
    _qTemp1.setFromUnitVectors(restDir, _vApplyDir);
    const baseQuaternion = bone.userData.baseQuaternion || _qTemp2.identity();
    bone.quaternion.slerp(_qTemp2.copy(baseQuaternion).multiply(_qTemp1), speed);
  };

  const applyBoneDirectionWithLocalBend = (bone, worldDir, axis, bendAngle, speed = 0.25) => {
    if (!bone) return;
    if (!worldDir || worldDir.lengthSq() < 0.00001 || isNaN(worldDir.x)) {
      resetBoneToRest(bone);
      return;
    }

    _vApplyDir.copy(worldDir).normalize();
    if (bone.parent) {
      bone.parent.updateMatrixWorld(true);
      bone.parent.getWorldQuaternion(_parentQuat);
      _vApplyDir.applyQuaternion(_parentQuat.invert());
    }

    const restDir = bone.userData.baseDirection || _vApplyRest.set(0, -1, 0);
    _qTemp1.setFromUnitVectors(restDir, _vApplyDir);
    _qTemp3.setFromAxisAngle(axis, bendAngle);

    const baseQuaternion = bone.userData.baseQuaternion || _qTemp2.identity();
    bone.quaternion.slerp(_qTemp2.copy(baseQuaternion).multiply(_qTemp1).multiply(_qTemp3), speed);
  };

  const clampDirectionFromRest = (bone, worldDir, maxAngle) => {
    if (!bone || !worldDir || worldDir.lengthSq() < 0.00001 || isNaN(worldDir.x)) return worldDir;

    _vClampDir.copy(worldDir).normalize();
    if (bone.parent) {
      bone.parent.updateMatrixWorld(true);
      bone.parent.getWorldQuaternion(_parentQuat);
      _vClampDir.applyQuaternion(_parentQuat.invert());
    }

    const restDir = bone.userData.baseDirection || _vClampRest.set(0, -1, 0);
    const angle = restDir.angleTo(_vClampDir);

    if (angle <= maxAngle || isNaN(angle)) return worldDir;

    _vClampDir.copy(restDir).lerp(_vClampDir, maxAngle / angle).normalize();

    if (bone.parent) {
      bone.parent.getWorldQuaternion(_parentQuat);
      _vClampDir.applyQuaternion(_parentQuat);
    }

    return _vClampDir;
  };

  const orientBoneSafe = (bone, startId, endId, speed = 0.25, maxAngle = Math.PI) => {
    if (!bone) return;
    const joints = latestJoints.current;
    if (!joints?.[startId] || !joints?.[endId] || !isVisible(startId) || !isVisible(endId)) {
      resetBoneToRest(bone);
      return;
    }

    const start = joints[startId];
    const end = joints[endId];
    _vOrientDir.set(end.x - start.x, -(end.y - start.y), -((getZ(end)) - (getZ(start))));

    applyBoneDirection(bone, clampDirectionFromRest(bone, _vOrientDir, maxAngle), speed);
  };

  // Modern Foot Grounding Solver (Supports Calf Raises / Toe Extensions)
  const handleFootOrientation = (isLeft, speed = 0.22) => {
    const j = latestJoints.current;
    const bone = isLeft ? bonesRef.current.leftFoot : bonesRef.current.rightFoot;
    if (!bone?.userData.baseWorldQuaternion) return;

    const heelId = isLeft ? MP.L_HEEL : MP.R_HEEL;
    const toeId = isLeft ? MP.L_FOOT_INDEX : MP.R_FOOT_INDEX;

    let isCalfRaise = false;
    let heelLiftAngle = 0;

    if (j?.[heelId] && j?.[toeId] && isVisible(heelId) && isVisible(toeId)) {
      const heelY = getScreenY(j[heelId]);
      const toeY = getScreenY(j[toeId]);
      if (heelY !== null && toeY !== null) {
        // In screen coords, smaller Y is higher up
        const heelElevation = toeY - heelY;
        if (heelElevation > 0.035) { // Heel noticeably above toe
          isCalfRaise = true;
          heelLiftAngle = THREE.MathUtils.clamp((heelElevation - 0.035) * 8.0, 0, Math.PI / 4);
        }
      }
    }

    if (isCalfRaise) {
      // Pitch foot forward to represent standing on tiptoes
      applySquatBend(bone, BEND_AXIS_X, heelLiftAngle, speed);
    } else {
      // Standard Flat-Foot Grounding
      if (bone.parent) {
        bone.parent.updateMatrixWorld(true);
        bone.parent.getWorldQuaternion(_parentQuat).invert();
        _qTemp1.copy(_parentQuat).multiply(bone.userData.baseWorldQuaternion);
        bone.quaternion.slerp(_qTemp1, speed);
      } else {
        bone.quaternion.slerp(bone.userData.baseWorldQuaternion, speed);
      }
    }
  };

  // Full 3D Leg Dynamics Solver (Supports Squats, Side Leg Raises, and Marching)
  const updateLeg = (isLeft) => {
    const j = latestJoints.current;
    const bones = bonesRef.current;

    const hipId = isLeft ? MP.L_HIP : MP.R_HIP;
    const kneeId = isLeft ? MP.L_KNEE : MP.R_KNEE;
    const ankleId = isLeft ? MP.L_ANKLE : MP.R_ANKLE;

    const upLegBone = isLeft ? bones.leftUpLeg : bones.rightUpLeg;
    const legBone = isLeft ? bones.leftLeg : bones.rightLeg;
    const kneeAngleRef = isLeft ? kneeAngleLeftRef : kneeAngleRightRef;

    if (!upLegBone) return;

    const hasJointData = j?.[hipId] && j?.[kneeId] && isVisible(hipId) && isVisible(kneeId);

    const activeSquatAmount = squatAmountRef.current > SQUAT_ACTIVE_THRESHOLD
      ? Math.pow((squatAmountRef.current - SQUAT_ACTIVE_THRESHOLD) / (1 - SQUAT_ACTIVE_THRESHOLD), 0.85)
      : 0;

    const hasAnkleData = j?.[ankleId] && isVisible(ankleId) && hasJointData;
    const rawKneeAngle = hasAnkleData
      ? (calculate3DAngle(j[hipId], j[kneeId], j[ankleId]) ?? 180)
      : 180;
    const targetKneeAngle = rawKneeAngle > KNEE_STRAIGHT_ANGLE_DEG ? 180 : rawKneeAngle;
    const trackedBendDeg = Math.max(0, 180 - targetKneeAngle - KNEE_BEND_DEADZONE_DEG);

    // Check for Marching or Side Leg Raises (3D hip displacement)
    let isPerformingLegMovement = false;
    if (hasJointData) {
      const hip = j[hipId];
      const knee = j[kneeId];
      const dx = knee.x - hip.x;
      const dy = -(knee.y - hip.y);
      const dz = -((getZ(knee)) - (getZ(hip)));

      // Detect lateral abduction (Side Leg Raise) or forward hip flexion (Marching)
      const isSideRaise = Math.abs(dx) > 0.18;
      const isMarching = dy > -0.75; // Knee lifted towards horizontal

      if (isSideRaise || isMarching) {
        isPerformingLegMovement = true;
      }
    }

    const shouldPoseLeg = activeSquatAmount > 0 || trackedBendDeg > 4 || isPerformingLegMovement;

    if (!shouldPoseLeg) {
      kneeAngleRef.current = THREE.MathUtils.lerp(kneeAngleRef.current, 180, 0.14);
      resetBoneToRest(upLegBone);
      resetBoneToRest(legBone);
      return;
    }

    // 1. Orient Thigh (UpLeg) with 3D direction vector
    if (hasJointData) {
      const hip = j[hipId];
      const knee = j[kneeId];
      const dx = knee.x - hip.x;
      const dy = -(knee.y - hip.y);
      const dz = -((getZ(knee)) - (getZ(hip))) * 0.6;

      _vLegDir.set(dx, dy, dz);
      
      // Allow up to 120° motion for side leg raises & high knee marching
      const clampedThigh = clampDirectionFromRest(upLegBone, _vLegDir, THREE.MathUtils.degToRad(120));
      const squatThighPitch = activeSquatAmount * THREE.MathUtils.degToRad(MAX_SQUAT_THIGH_PITCH_DEG);
      
      applyBoneDirectionWithLocalBend(upLegBone, clampedThigh, BEND_AXIS_X, squatThighPitch, 0.18);
    } else if (activeSquatAmount > 0) {
      const squatThighPitch = activeSquatAmount * THREE.MathUtils.degToRad(MAX_SQUAT_THIGH_PITCH_DEG);
      applySquatBend(upLegBone, BEND_AXIS_X, squatThighPitch, 0.18);
    }

    // 2. Drive Knee Bend (Leg/Shin)
    if (legBone) {
      kneeAngleRef.current = THREE.MathUtils.lerp(kneeAngleRef.current, targetKneeAngle, 0.15);

      const smoothedTrackedBendDeg = Math.max(0, 180 - kneeAngleRef.current - KNEE_BEND_DEADZONE_DEG);
      const squatKneeBendDeg = activeSquatAmount * MAX_SQUAT_KNEE_BEND_DEG;
      const finalBendDeg = Math.max(smoothedTrackedBendDeg, squatKneeBendDeg);

      if (finalBendDeg < 1) {
        resetBoneToRest(legBone);
      } else {
        const bendRad = THREE.MathUtils.degToRad(finalBendDeg);
        applySquatBend(legBone, BEND_AXIS_X, bendRad, 0.18);
      }
    }
  };

  useEffect(() => {
    function download() {
      if (!group.current) return;
      const exporter = new GLTFExporter();
      exporter.parse(
        group.current,
        (gltfBuffer) => {
          const blob = new Blob([gltfBuffer], { type: "application/octet-stream" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `avatar_${Date.now()}.glb`;
          link.click();
          URL.revokeObjectURL(link.href);
        },
        (error) => { console.error("Export error:", error); },
        { binary: true }
      );
    }
    setDownload(download);
  }, [setDownload]);

  useEffect(() => {
    const isLiveMode = new URLSearchParams(window.location.search).get("mode") === "live" || !!latestJoints.current;
    if (isLiveMode) {
      mixer.stopAllAction();
      return;
    }
    if (actions[pose]) {
      actions[pose].reset().fadeIn(0.2).play();
      return () => actions[pose]?.fadeOut(0.2);
    }
  }, [actions, pose, mixer]);

  useFrame(() => {
    frameCounter.current++;
    const shouldLogDiag = frameCounter.current % 180 === 0;

    if (!nodes.Plane?.skeleton) return;

    try {
      const bones = bonesRef.current;
      const now = performance.now();

      if (now - lastPoseTimestamp.current > POSE_TIMEOUT_MS) {
        latestJoints.current = null;
      }

      const isLiveMode = !!latestJoints.current;

      if (isLiveMode && mixer) {
        mixer.stopAllAction();
      }

      const torsoVisible = isLiveMode && hasStableTorso();
      torsoVisibleRef.current = torsoVisible;

      // Camera Framing
      if (camera) {
        const targetCamZ = isLiveMode ? 3.8 : 2.8;
        const targetCamY = isLiveMode ? 0.9 : 0.8;
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
      }

      // Foot-to-Floor Grounding Solver
      const isSquatting = squatAmountRef.current > SQUAT_ACTIVE_THRESHOLD;
      if (isLiveMode && bones.leftFoot && bones.rightFoot && !isSquatting) {
        bones.leftFoot.getWorldPosition(_vTemp);
        bones.rightFoot.getWorldPosition(_vTemp2);

        const lowestFootY = Math.min(_vTemp.y, _vTemp2.y);
        const targetYOffset = LIVE_AVATAR_BASE_Y - lowestFootY;

        liveGroupPosition.current.y = THREE.MathUtils.lerp(
          liveGroupPosition.current.y,
          THREE.MathUtils.clamp(targetYOffset, -0.25, 0.25),
          0.04
        );
      } else {
        liveGroupPosition.current.y = THREE.MathUtils.lerp(liveGroupPosition.current.y, LIVE_AVATAR_BASE_Y, 0.035);
      }

      if (group.current) {
        const targetPosition = isLiveMode ? liveGroupPosition.current : baseGroupPosition.current;
        const targetRotation = isLiveMode ? liveGroupRotation.current : baseGroupRotation.current;
        group.current.position.lerp(targetPosition, isLiveMode ? 0.08 : 0.2);
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetRotation.x, isLiveMode ? 0.14 : 0.2);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, targetRotation.z, isLiveMode ? 0.14 : 0.2);

        if (!isLiveMode) {
          group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRotation.y, 0.2);
        }
      }

      if (!isLiveMode) {
        Object.values(bones).forEach(resetBoneToRest);
        resetBonePosition(bones.hips, 0.18);
        bones.hips?.updateMatrixWorld(true);
        nodes.Plane.skeleton.update();
        return;
      }

      // Smooth Hip Calibration & Squat/Chair Descent Solver
      const isSeated = isSeatedRef.current;
      if (
        latestJoints.current[MP.L_HIP] &&
        latestJoints.current[MP.R_HIP] &&
        isVisible(MP.L_HIP) &&
        isVisible(MP.R_HIP)
      ) {
        const lHipScreenY = getScreenY(latestJoints.current[MP.L_HIP]);
        const rHipScreenY = getScreenY(latestJoints.current[MP.R_HIP]);

        if (!isSeated && lHipScreenY !== null && rHipScreenY !== null) {
          const currentHipY = (lHipScreenY + rHipScreenY) / 2;

          if (!calibrationRef.current) {
            calibrationRef.current = { standingHipY: currentHipY };
          } else if (currentHipY < calibrationRef.current.standingHipY) {
            calibrationRef.current.standingHipY = THREE.MathUtils.lerp(
              calibrationRef.current.standingHipY,
              currentHipY,
              0.05
            );
          }

          const hipDrop = currentHipY - calibrationRef.current.standingHipY;
          const DROP_THRESHOLD = 0.045;

          let crouchAmount = 0;
          if (hipDrop > DROP_THRESHOLD) {
            crouchAmount = THREE.MathUtils.clamp((hipDrop - DROP_THRESHOLD) / 0.16, 0, 1.0);
          }

          squatAmountRef.current = THREE.MathUtils.lerp(squatAmountRef.current, crouchAmount, 0.15);

          if (bones.hips?.userData.basePosition) {
            _vTemp.copy(bones.hips.userData.basePosition);

            _vTemp2.set(0, -1, 0);
            if (bones.hips.parent) {
              bones.hips.parent.getWorldQuaternion(_parentQuat);
              _vTemp2.applyQuaternion(_parentQuat.invert());
            }

            const maxSquatDrop = 24.0;
            _vTemp.addScaledVector(_vTemp2, squatAmountRef.current * maxSquatDrop);
            bones.hips.position.lerp(_vTemp, 0.15);
            bones.hips.updateMatrixWorld(true);
          }
        }
      } else {
        if (bones.hips) resetBonePosition(bones.hips, 0.12);
        squatAmountRef.current = THREE.MathUtils.lerp(squatAmountRef.current, 0, 0.12);
      }

      // Enhanced Spine (Supports Torso Twists and Side Bends)
      if (
        bones.spine &&
        latestJoints.current[MP.L_SHOULDER] &&
        latestJoints.current[MP.R_SHOULDER] &&
        latestJoints.current[MP.L_HIP] &&
        latestJoints.current[MP.R_HIP] &&
        isVisible(MP.L_SHOULDER) &&
        isVisible(MP.R_SHOULDER)
      ) {
        const lShoulder = latestJoints.current[MP.L_SHOULDER];
        const rShoulder = latestJoints.current[MP.R_SHOULDER];
        const lHip = latestJoints.current[MP.L_HIP];
        const rHip = latestJoints.current[MP.R_HIP];

        const sz_lS = getZ(lShoulder);
        const sz_rS = getZ(rShoulder);
        const sz_lH = getZ(lHip);
        const sz_rH = getZ(rHip);

        // Spine Pitch (forward/back) and Roll (side bends)
        _vSpineDir.set(
          (lShoulder.x + rShoulder.x - lHip.x - rHip.x) * 0.12, // Increased factor for lateral side bends
          0.9 + (-(lShoulder.y + rShoulder.y - lHip.y - rHip.y) * 0.015),
          (-(sz_lS + sz_rS - sz_lH - sz_rH)) * 0.06
        );

        if (_vSpineDir.lengthSq() > 0.00001) {
          applyBoneDirection(bones.spine, _vSpineDir, 0.08);
        }

        // Torso Twist / Yaw calculation
        if (torsoVisible && group.current) {
          const bodyDx = (lShoulder.x - rShoulder.x + lHip.x - rHip.x) * 0.5;
          const bodyDz = (-(sz_lS - sz_rS) * 3.0 + -(sz_lH - sz_rH) * 3.0) * 0.5;
          let rawYaw = 0;

          if (Math.abs(bodyDz) > 0.001) {
            rawYaw = Math.atan2(bodyDz, bodyDx);
          } else {
            const nose = latestJoints.current[MP.NOSE];
            if (nose) {
              const noseOffset = (nose.x - (lShoulder.x + rShoulder.x) / 2) / (Math.abs(bodyDx) || 0.2);
              rawYaw = THREE.MathUtils.clamp(noseOffset * 1.2, -0.8, 0.8);
            }
          }

          const DEADZONE = THREE.MathUtils.degToRad(2.0);
          const MAX_YAW = THREE.MathUtils.degToRad(85); // Expanded for torso twists
          let desiredYaw = Math.abs(rawYaw) > DEADZONE ? rawYaw : 0;
          desiredYaw = THREE.MathUtils.clamp(desiredYaw, -MAX_YAW, MAX_YAW);

          turnTargetRef.current = THREE.MathUtils.lerp(turnTargetRef.current, desiredYaw, 0.15);
        }
      } else {
        resetBoneToRest(bones.spine);
        turnTargetRef.current = THREE.MathUtils.lerp(turnTargetRef.current, 0, 0.1);
      }

      bones.spine?.updateMatrixWorld(true);

      // Neck & Head
      if (bones.neck && latestJoints.current[MP.L_SHOULDER] && latestJoints.current[MP.R_SHOULDER] && latestJoints.current[MP.NOSE] && isVisible(MP.NOSE)) {
        const nose = latestJoints.current[MP.NOSE];
        const midX = (latestJoints.current[MP.L_SHOULDER].x + latestJoints.current[MP.R_SHOULDER].x) / 2;
        const midY = (latestJoints.current[MP.L_SHOULDER].y + latestJoints.current[MP.R_SHOULDER].y) / 2;
        const midZ = (getZ(latestJoints.current[MP.L_SHOULDER]) + getZ(latestJoints.current[MP.R_SHOULDER])) / 2;

        _vTemp.set((nose.x - midX) * 0.01, -(nose.y - midY) * 0.15, -((getZ(nose)) - midZ) * 0.01);
        if (_vTemp.lengthSq() > 0.00001) applyBoneDirection(bones.neck, _vTemp, 0.02);
      } else {
        resetBoneToRest(bones.neck);
      }

      if (bones.head && latestJoints.current[MP.L_EYE] && latestJoints.current[MP.R_EYE] && latestJoints.current[MP.NOSE] && isVisible(MP.NOSE)) {
        const lEye = latestJoints.current[MP.L_EYE];
        const rEye = latestJoints.current[MP.R_EYE];
        const nose = latestJoints.current[MP.NOSE];

        _vTemp.set((rEye.x - lEye.x) * 0.005, 0, -((getZ(nose)) - (getZ(lEye) + getZ(rEye)) / 2) * 0.005);
        if (_vTemp.lengthSq() > 0.00001) applyBoneDirection(bones.head, _vTemp, 0.025);
      } else {
        resetBoneToRest(bones.head);
      }

      // Upper Body Arms (Overhead Reaches & Wall Push-ups / Forward Extensions)
      const lShoulder = latestJoints.current[MP.L_SHOULDER];
      const rShoulder = latestJoints.current[MP.R_SHOULDER];
      if (lShoulder && rShoulder && bones.leftShoulder && bones.rightShoulder) {
        const lY = getScreenY(lShoulder);
        const rY = getScreenY(rShoulder);
        if (lY !== null && rY !== null) {
          const tiltAmount = THREE.MathUtils.clamp((lY - rY) * 1.8, -0.35, 0.35);
          applySquatBend(bones.leftShoulder, BEND_AXIS_X, -tiltAmount, 0.12);
          applySquatBend(bones.rightShoulder, BEND_AXIS_X, -tiltAmount, 0.12);

          if (bones.spine) {
            applySquatBend(bones.spine, BEND_AXIS_X, -tiltAmount * 0.5, 0.12);
          }
        }
      }

      // Unclamped 180° range to allow full Overhead Reaches and forward Wall Push-ups
      orientBoneSafe(bones.leftArm, MP.L_SHOULDER, MP.L_ELBOW, 0.16, Math.PI);
      orientBoneSafe(bones.leftForeArm, MP.L_ELBOW, MP.L_WRIST, 0.18, Math.PI);

      orientBoneSafe(bones.rightArm, MP.R_SHOULDER, MP.R_ELBOW, 0.16, Math.PI);
      orientBoneSafe(bones.rightForeArm, MP.R_ELBOW, MP.R_WRIST, 0.18, Math.PI);

      resetBoneToRest(bones.leftHand);
      resetBoneToRest(bones.rightHand);

      // Leg Tracking Solver (Squats, Side Leg Raises, Marching)
      if (isLiveMode) {
        updateLeg(true);  // Left leg
        updateLeg(false); // Right leg
      } else {
        resetBoneToRest(bones.leftUpLeg);
        resetBoneToRest(bones.leftLeg);
        resetBoneToRest(bones.rightUpLeg);
        resetBoneToRest(bones.rightLeg);
      }

      // Feet Alignment & Calf Raise Solver
      handleFootOrientation(true, 0.55);  // Left foot
      handleFootOrientation(false, 0.55); // Right foot

      // Group Yaw Sync
      if (isLiveMode && group.current) {
        const targetYaw = torsoVisibleRef.current ? turnTargetRef.current * 0.6 : 0;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetYaw, 0.12);
      }

      // Final Skeleton Sync
      if (bones.hips) bones.hips.updateMatrixWorld(true);
      nodes.Plane.skeleton.update();
    } catch (err) {
      if (shouldLogDiag) console.warn("Realtime mapping step missed:", err?.message || err);
    }
  });

  if (!nodes || !nodes.Plane || !nodes.mixamorigHips) {
    return null;
  }

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <skinnedMesh
            name="Plane"
            geometry={nodes.Plane.geometry}
            material={skin}
            skeleton={nodes.Plane.skeleton}
            castShadow
            receiveShadow
          />
          <primitive object={nodes.mixamorigHips} />
          {Object.keys(customization).map(
            (key) =>
              customization[key]?.asset?.url && (
                <Suspense key={customization[key].asset?.id || key} fallback={null}>
                  <Asset
                    categoryName={key}
                    url={pb.files.getUrl(customization[key].asset, customization[key].asset.url)}
                    skeleton={nodes.Plane?.skeleton}
                  />
                </Suspense>
              )
          )}
        </group>
      </group>
    </group>
  );
};

useGLTF.preload("/models/Armature.glb");