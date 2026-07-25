import { Suspense, useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF, useAnimations } from "@react-three/drei";
import { useConfiguratorStore, pb } from "../store";
import { Asset } from "./Asset";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// Keep avatar root anchored at ground level (Y = 0)
const LIVE_AVATAR_BASE_Y = 0;
const POSE_TIMEOUT_MS = 300; // Time before stale tracking data drops to rest pose

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

// Reusable math objects
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _parentWorldQuat = new THREE.Quaternion();
const BEND_AXIS_X = new THREE.Vector3(1, 0, 0);
const BEND_AXIS_Y = new THREE.Vector3(0, 1, 0);
const BEND_AXIS_Z = new THREE.Vector3(0, 0, 1);

const getRestDirection = (bone) => {
  const child = bone.children.find((c) => c.isBone);
  if (!child) return new THREE.Vector3(0, 1, 0);
  return child.position.clone().normalize();
};

const getScreenY = (joint) => {
  const y = joint?.screenY;
  return typeof y === "number" && y >= 0 && y <= 1 ? y : null;
};

const getScreenX = (joint) => {
  const x = joint?.screenX;
  return typeof x === "number" && x >= 0 && x <= 1 ? x : null;
};

const calculate3DAngle = (pA, pB, pC) => {
  if (!pA || !pB || !pC) return null;
  // Scale Z depth down by 0.4 to match 2D normalized screen proportions
  _v1.set(pA.x - pB.x, -(pA.y - pB.y), -(pA.z - pB.z) * 0.4);
  _v2.set(pC.x - pB.x, -(pC.y - pB.y), -(pC.z - pB.z) * 0.4);
  const dot = _v1.dot(_v2);
  const mag1 = _v1.length();
  const mag2 = _v2.length();
  if (mag1 * mag2 === 0) return null;
  const cosAngle = THREE.MathUtils.clamp(dot / (mag1 * mag2), -1, 1);
  return THREE.MathUtils.radToDeg(Math.acos(cosAngle));
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
  const trackingOriginRef = useRef(null);
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
      prev.z = THREE.MathUtils.lerp(prev.z, joint.z, alpha);
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
    return joint.visibility === undefined || joint.visibility > 0.35;
  };

  const getJoint = (id) => latestJoints.current?.[id];

  const hasStableTorso = () => {
    const ids = [MP.L_SHOULDER, MP.R_SHOULDER, MP.L_HIP, MP.R_HIP];
    return ids.every((id) => {
      const joint = latestJoints.current?.[id];
      const screenX = getScreenX(joint);
      const screenY = getScreenY(joint);
      return (
        joint &&
        (joint.visibility === undefined || joint.visibility > 0.45) &&
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
      trackingOriginRef.current = null;
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
          bone.userData.baseQuaternion = bone.quaternion.clone();
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
      storeBone("leftUpLeg", getBone("mixamorigLeftUpLeg", ["LeftUpLeg", "leftUpLeg", "Thigh_L"]));
      storeBone("leftLeg", getBone("mixamorigLeftLeg", ["LeftLeg", "leftLeg", "Shin_L"]));
      storeBone("rightUpLeg", getBone("mixamorigRightUpLeg", ["RightUpLeg", "rightUpLeg", "Thigh_R"]));
      storeBone("rightLeg", getBone("mixamorigRightLeg", ["RightLeg", "rightLeg", "Shin_R"]));
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
    if (!bone?.userData.baseQuaternion) return;
    _q1.setFromAxisAngle(axis, angle);
    _q2.copy(bone.userData.baseQuaternion).multiply(_q1);
    bone.quaternion.slerp(_q2, speed);
  };

  const midpoint = (a, b) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    screenX: getScreenX(a) !== null && getScreenX(b) !== null ? (getScreenX(a) + getScreenX(b)) / 2 : undefined,
    screenY: getScreenY(a) !== null && getScreenY(b) !== null ? (getScreenY(a) + getScreenY(b)) / 2 : undefined,
  });

  const getBodyCenter = () => {
    const lHip = getJoint(MP.L_HIP);
    const rHip = getJoint(MP.R_HIP);
    const lShoulder = getJoint(MP.L_SHOULDER);
    const rShoulder = getJoint(MP.R_SHOULDER);

    if (lHip && rHip && lShoulder && rShoulder && isVisible(MP.L_HIP) && isVisible(MP.R_HIP) && isVisible(MP.L_SHOULDER) && isVisible(MP.R_SHOULDER)) {
      return midpoint(midpoint(lHip, rHip), midpoint(lShoulder, rShoulder));
    }
    if (lHip && rHip && isVisible(MP.L_HIP) && isVisible(MP.R_HIP)) {
      return midpoint(lHip, rHip);
    }
    return null;
  };

  const applyBoneDirection = (bone, worldDir, speed = 0.25) => {
    if (!bone) return;
    if (!worldDir || worldDir.lengthSq() < 0.00001) {
      resetBoneToRest(bone);
      return;
    }

    _vDir.copy(worldDir).normalize();
    if (bone.parent) {
      bone.parent.updateMatrixWorld(true);
      bone.parent.getWorldQuaternion(_parentWorldQuat);
      _vDir.applyQuaternion(_parentWorldQuat.invert());
    }

    const restDir = bone.userData.baseDirection || _v1.set(0, 1, 0).applyQuaternion(bone.userData.baseQuaternion || _q1.identity());
    _q1.setFromUnitVectors(restDir, _vDir);
    const baseQuaternion = bone.userData.baseQuaternion || _q2.identity();
    bone.quaternion.slerp(_q2.copy(baseQuaternion).multiply(_q1), speed);
  };

  const clampDirectionFromRest = (bone, worldDir, maxAngle) => {
    if (!bone || !worldDir || worldDir.lengthSq() < 0.00001) return worldDir;

    _vDir.copy(worldDir).normalize();
    if (bone.parent) {
      bone.parent.updateMatrixWorld(true);
      bone.parent.getWorldQuaternion(_parentWorldQuat);
      _vDir.applyQuaternion(_parentWorldQuat.invert());
    }

    const restDir = bone.userData.baseDirection || _v1.set(0, 1, 0);
    const angle = restDir.angleTo(_vDir);

    if (angle <= maxAngle) return worldDir;

    _vDir.copy(restDir).slerp(_vDir, maxAngle / angle).normalize();

    if (bone.parent) {
      bone.parent.getWorldQuaternion(_parentWorldQuat);
      _vDir.applyQuaternion(_parentWorldQuat);
    }

    return _vDir;
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
    _v1.set(end.x - start.x, -(end.y - start.y), -(end.z - start.z));

    applyBoneDirection(bone, clampDirectionFromRest(bone, _v1, maxAngle), speed);
  };

  // Advanced Leg Kinematics Solver
  const updateLeg = (isLeft) => {
    const j = latestJoints.current;
    const bones = bonesRef.current;

    const hipId = isLeft ? MP.L_HIP : MP.R_HIP;
    const kneeId = isLeft ? MP.L_KNEE : MP.R_KNEE;
    const ankleId = isLeft ? MP.L_ANKLE : MP.R_ANKLE;

    const upLegBone = isLeft ? bones.leftUpLeg : bones.rightUpLeg;
    const legBone = isLeft ? bones.leftLeg : bones.rightLeg;
    const kneeAngleRef = isLeft ? kneeAngleLeftRef : kneeAngleRightRef;

    if (!j?.[hipId] || !j?.[kneeId] || !isVisible(hipId) || !isVisible(kneeId) || !upLegBone) {
      kneeAngleRef.current = THREE.MathUtils.lerp(kneeAngleRef.current, 180, 0.14);
      resetBoneToRest(upLegBone);
      resetBoneToRest(legBone);
      return;
    }

    // Upper Thigh Vector Calculation
    const hip = j[hipId];
    const knee = j[kneeId];
    const dx = knee.x - hip.x;
    const dy = -(knee.y - hip.y);
    let dz = -(knee.z - hip.z);

    if (dy < 0) {
      const downwardRatio = THREE.MathUtils.clamp(-dy / 0.2, 0, 1);
      dz = THREE.MathUtils.lerp(dz, 0, downwardRatio * 0.85);
    } else if (Math.abs(dy) < 0.12) {
      dz = Math.max(dz, 0.25);
    }

    _v1.set(dx, dy, dz);
    const clampedThigh = clampDirectionFromRest(upLegBone, _v1, THREE.MathUtils.degToRad(110));
    applyBoneDirection(upLegBone, clampedThigh, 0.14);

    // Lower Leg Hinge Flexion
    if (legBone && j[ankleId] && isVisible(kneeId) && isVisible(ankleId)) {
      let rawAngle = calculate3DAngle(j[hipId], j[kneeId], j[ankleId]) ?? 180;

      const ankle = j[ankleId];
      const isLegLowered = dy < -0.12;
      const isAnkleBelowKnee = ankle && ankle.y > knee.y;

      if (isLegLowered && isAnkleBelowKnee) {
        const straightenFactor = THREE.MathUtils.clamp((-dy - 0.12) / 0.15, 0, 1);
        rawAngle = THREE.MathUtils.lerp(rawAngle, 180, straightenFactor * 0.85);
      }

      kneeAngleRef.current = THREE.MathUtils.lerp(kneeAngleRef.current, rawAngle, 0.14);

      const bendDeg = THREE.MathUtils.clamp(180 - kneeAngleRef.current, 0, 135);
      const bendRad = THREE.MathUtils.degToRad(bendDeg);

      applySquatBend(legBone, BEND_AXIS_X, -bendRad, 0.16);
    } else {
      kneeAngleRef.current = THREE.MathUtils.lerp(kneeAngleRef.current, 180, 0.14);
      resetBoneToRest(legBone);
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

      // Check for stale pose frame timeout (>300ms)
      if (now - lastPoseTimestamp.current > POSE_TIMEOUT_MS) {
        latestJoints.current = null;
      }

      const isLiveMode = !!latestJoints.current;

      // Stop animation clips from overwriting bones during live pose tracking
      if (isLiveMode && mixer) {
        mixer.stopAllAction();
      }

      const torsoVisible = isLiveMode && hasStableTorso();
      torsoVisibleRef.current = torsoVisible;

      // 1. Camera Framing
      if (camera) {
        const targetCamZ = isLiveMode ? 3.8 : 2.8;
        const targetCamY = isLiveMode ? 0.9 : 0.8;
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
      }

      // Group Base Position & Rotation
      if (group.current) {
        const targetPosition = isLiveMode ? liveGroupPosition.current : baseGroupPosition.current;
        const targetRotation = isLiveMode ? liveGroupRotation.current : baseGroupRotation.current;
        group.current.position.lerp(targetPosition, isLiveMode ? 0.16 : 0.2);
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetRotation.x, isLiveMode ? 0.14 : 0.2);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, targetRotation.z, isLiveMode ? 0.14 : 0.2);

        if (!isLiveMode) {
          group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRotation.y, 0.2);
        }
      }

      // Fallback to rest position if no live tracking data is active
      if (!isLiveMode) {
        Object.values(bones).forEach(resetBoneToRest);
        resetBonePosition(bones.hips, 0.18);
        bones.hips?.updateMatrixWorld(true);
        nodes.Plane.skeleton.update();
        return;
      }

      // 2. Controlled Hip Squat
      const isSeated = isSeatedRef.current;
      if (latestJoints.current[MP.L_HIP] && latestJoints.current[MP.R_HIP]) {
        const bodyCenter = getBodyCenter();
        if (bodyCenter) {
          const centerScreenX = getScreenX(bodyCenter);
          const centerScreenY = getScreenY(bodyCenter);

          if (!trackingOriginRef.current && centerScreenX !== null && centerScreenY !== null) {
            trackingOriginRef.current = { screenX: centerScreenX, screenY: centerScreenY };
          }

          let crouchAmount = 0;
          const lHipScreenY = getScreenY(latestJoints.current[MP.L_HIP]);
          const rHipScreenY = getScreenY(latestJoints.current[MP.R_HIP]);

          if (!isSeated && lHipScreenY !== null && rHipScreenY !== null) {
            const currentHipY = (lHipScreenY + rHipScreenY) / 2;

            // baseline calibration (Prevents autonomous downward drifting)
            if (!calibrationRef.current) {
              calibrationRef.current = { standingHipY: currentHipY };
            }

            const hipDrop = currentHipY - calibrationRef.current.standingHipY;
            const DROP_THRESHOLD = 0.035;

            if (hipDrop > DROP_THRESHOLD) {
              // Relaxed divisor from 0.08 to 0.14 for a more gradual, natural sit
              crouchAmount = THREE.MathUtils.clamp((hipDrop - DROP_THRESHOLD) / 0.14, 0, 1.0);
            }
          }

          squatAmountRef.current = THREE.MathUtils.lerp(squatAmountRef.current, isSeated ? 0 : crouchAmount, 0.18);

          if (bones.hips?.userData.basePosition) {
            _v1.copy(bones.hips.userData.basePosition);
            if (isSeated) {
              _v1.y -= 15.0;
              _v1.z += 5.0;
            } else {
              const maxSquatDrop = 12.0;
              _v1.y -= squatAmountRef.current * maxSquatDrop;
              _v1.z += squatAmountRef.current * 3.0;
            }
            bones.hips.position.lerp(_v1, 0.12);
          }
        }
      }

      // 3. Spine & Torso Rotation
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

        _v1.set(
          (lShoulder.x + rShoulder.x - lHip.x - rHip.x) * 0.06,
          0.9 + (-(lShoulder.y + rShoulder.y - lHip.y - rHip.y) * 0.015),
          (-(lShoulder.z + rShoulder.z - lHip.z - rHip.z)) * 0.06
        );

        if (_v1.lengthSq() > 0.00001) {
          applyBoneDirection(bones.spine, _v1, 0.05);
        }

        if (torsoVisible && group.current) {
          const bodyDx = (lShoulder.x - rShoulder.x + lHip.x - rHip.x) * 0.5;
          const bodyDz = (-(lShoulder.z - rShoulder.z) * 3.0 + -(lHip.z - rHip.z) * 3.0) * 0.5;
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
          const MAX_YAW = THREE.MathUtils.degToRad(75);
          let desiredYaw = Math.abs(rawYaw) > DEADZONE ? rawYaw : 0;
          desiredYaw = THREE.MathUtils.clamp(desiredYaw, -MAX_YAW, MAX_YAW);

          turnTargetRef.current = THREE.MathUtils.lerp(turnTargetRef.current, desiredYaw, 0.15);
        }
      } else {
        resetBoneToRest(bones.spine);
        turnTargetRef.current = THREE.MathUtils.lerp(turnTargetRef.current, 0, 0.1);
      }

      bones.spine?.updateMatrixWorld(true);

      // 4. Neck & Head
      if (bones.neck && latestJoints.current[MP.L_SHOULDER] && latestJoints.current[MP.R_SHOULDER] && latestJoints.current[MP.NOSE] && isVisible(MP.NOSE)) {
        const nose = latestJoints.current[MP.NOSE];
        const midX = (latestJoints.current[MP.L_SHOULDER].x + latestJoints.current[MP.R_SHOULDER].x) / 2;
        const midY = (latestJoints.current[MP.L_SHOULDER].y + latestJoints.current[MP.R_SHOULDER].y) / 2;
        const midZ = (latestJoints.current[MP.L_SHOULDER].z + latestJoints.current[MP.R_SHOULDER].z) / 2;

        _v1.set((nose.x - midX) * 0.01, -(nose.y - midY) * 0.15, -(nose.z - midZ) * 0.01);
        if (_v1.lengthSq() > 0.00001) applyBoneDirection(bones.neck, _v1, 0.02);
      } else {
        resetBoneToRest(bones.neck);
      }

      if (bones.head && latestJoints.current[MP.L_EYE] && latestJoints.current[MP.R_EYE] && latestJoints.current[MP.NOSE] && isVisible(MP.NOSE)) {
        const lEye = latestJoints.current[MP.L_EYE];
        const rEye = latestJoints.current[MP.R_EYE];
        const nose = latestJoints.current[MP.NOSE];

        _v1.set((rEye.x - lEye.x) * 0.005, 0, -(nose.z - (lEye.z + rEye.z) / 2) * 0.005);
        if (_v1.lengthSq() > 0.00001) applyBoneDirection(bones.head, _v1, 0.025);
      } else {
        resetBoneToRest(bones.head);
      }

      // 5. Upper Body Arms
      const lShoulder = latestJoints.current[MP.L_SHOULDER];
      const rShoulder = latestJoints.current[MP.R_SHOULDER];
      if (lShoulder && rShoulder && bones.leftShoulder && bones.rightShoulder) {
        const lY = getScreenY(lShoulder);
        const rY = getScreenY(rShoulder);
        if (lY !== null && rY !== null) {
          const tiltAmount = THREE.MathUtils.clamp((lY - rY) * 1.8, -0.35, 0.35);
          applySquatBend(bones.leftShoulder, BEND_AXIS_Z, -tiltAmount, 0.12);
          applySquatBend(bones.rightShoulder, BEND_AXIS_Z, -tiltAmount, 0.12);

          if (bones.spine) {
            applySquatBend(bones.spine, BEND_AXIS_Z, -tiltAmount * 0.5, 0.12);
          }
        }
      }

      orientBoneSafe(bones.leftArm, MP.L_SHOULDER, MP.L_ELBOW, 0.14, THREE.MathUtils.degToRad(175));
      orientBoneSafe(bones.leftForeArm, MP.L_ELBOW, MP.L_WRIST, 0.16, THREE.MathUtils.degToRad(145));

      orientBoneSafe(bones.rightArm, MP.R_SHOULDER, MP.R_ELBOW, 0.14, THREE.MathUtils.degToRad(175));
      orientBoneSafe(bones.rightForeArm, MP.R_ELBOW, MP.R_WRIST, 0.16, THREE.MathUtils.degToRad(145));

      resetBoneToRest(bones.leftHand);
      resetBoneToRest(bones.rightHand);

      // 6. Stable Leg Tracking
      if (isLiveMode) {
        updateLeg(true);  // Left leg kinematics
        updateLeg(false); // Right leg kinematics
      } else {
        resetBoneToRest(bones.leftUpLeg);
        resetBoneToRest(bones.leftLeg);
        resetBoneToRest(bones.rightUpLeg);
        resetBoneToRest(bones.rightLeg);
      }

      // 7. Feet Alignment
      orientBoneSafe(bones.leftFoot, MP.L_ANKLE, MP.L_FOOT_INDEX, 0.08, THREE.MathUtils.degToRad(45));
      orientBoneSafe(bones.rightFoot, MP.R_ANKLE, MP.R_FOOT_INDEX, 0.08, THREE.MathUtils.degToRad(45));

      // Smooth Group Yaw Sync (Eliminates sudden 360-degree snap spins)
      if (isLiveMode && group.current) {
        const targetYaw = torsoVisibleRef.current ? turnTargetRef.current * 0.6 : 0;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetYaw, 0.12);
      }

      // 8. Final Skeleton Sync
      if (bones.hips) bones.hips.updateMatrixWorld(true);
      nodes.Plane.skeleton.update();
    } catch (err) {
      if (shouldLogDiag) console.warn("Realtime mapping step missed:", err);
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