import { Suspense, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber"; 
import * as THREE from 'three'; 
import { useGLTF, useAnimations } from "@react-three/drei";
import { useConfiguratorStore, pb } from "../store";
import { Asset } from "./Asset";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { prune, dedup, draco, quantize } from "@gltf-transform/functions";
import { NodeIO } from "@gltf-transform/core";

const LIVE_AVATAR_BASE_Y = -0.15;

const MP = {
  NOSE: 0,
  L_EYE_INNER: 1,    L_EYE: 2,           L_EYE_OUTER: 3,
  R_EYE_INNER: 4,    R_EYE: 5,           R_EYE_OUTER: 6,
  L_EAR: 7,          R_EAR: 8,
  MOUTH_LEFT: 9,     MOUTH_RIGHT: 10,
  L_SHOULDER: 11,    R_SHOULDER: 12,
  L_ELBOW: 13,        R_ELBOW: 14,
  L_WRIST: 15,        R_WRIST: 16,
  L_PINKY: 17,        L_INDEX: 18,        L_THUMB: 19,
  R_PINKY: 20,        R_INDEX: 21,        R_THUMB: 22,
  L_HIP: 23,          R_HIP: 24,
  L_KNEE: 25,         R_KNEE: 26,
  L_ANKLE: 27,        R_ANKLE: 28,
  L_HEEL: 29,         L_FOOT_INDEX: 30,
  R_HEEL: 31,         R_FOOT_INDEX: 32
};

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

export const Avatar = ({ ...props }) => {
  const group = useRef();
  
  const { scene, nodes } = useGLTF("/models/Armature.glb");
  const { animations } = useGLTF("/models/Poses.glb");
  const { actions, mixer } = useAnimations(animations, group);
  
  const customization = useConfiguratorStore((state) => state.customization);
  const skin = useConfiguratorStore((state) => state.skin);
  const pose = useConfiguratorStore((state) => state.pose);
  const setDownload = useConfiguratorStore((state) => state.setDownload);
  
  const latestJoints = useRef(null);
  const smoothedJoints = useRef(null);
  const calibrationRef = useRef(null);
  const trackingOriginRef = useRef(null);
  const squatAmountRef = useRef(0);
  const frameCounter = useRef(0);
  const torsoVisibleRef = useRef(false);
  
  const baseGroupPosition = useRef(new THREE.Vector3());
  const baseGroupRotation = useRef(new THREE.Euler());
  const liveGroupPosition = useRef(new THREE.Vector3(0, LIVE_AVATAR_BASE_Y, 0.02));
  const liveGroupRotation = useRef(new THREE.Euler(-0.02, 0, 0));
  const turnTargetRef = useRef(0);

  const bonesRef = useRef({
    neck: null, head: null,
    leftShoulder: null, rightShoulder: null,
    leftArm: null, leftForeArm: null, rightArm: null, rightForeArm: null,
    leftHand: null, rightHand: null,
    spine: null, hips: null,
    leftUpLeg: null, leftLeg: null, rightUpLeg: null, rightLeg: null,
    leftFoot: null, rightFoot: null
  });

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

  const smoothPose = (incoming, alpha = 0.35) => {
    if (!incoming) return null;
    if (!smoothedJoints.current) {
      smoothedJoints.current = incoming.map((j) => ({
        ...j,
        screenX: getScreenX(j) ?? undefined,
        screenY: getScreenY(j) ?? undefined,
      }));
      return smoothedJoints.current;
    }

    smoothedJoints.current = incoming.map((joint, i) => {
      const prev = smoothedJoints.current[i] || joint;
      
      const prevScreenX = getScreenX(prev);
      const currScreenX = getScreenX(joint);
      const prevScreenY = getScreenY(prev);
      const currScreenY = getScreenY(joint);

      return {
        x: THREE.MathUtils.lerp(prev.x, joint.x, alpha),
        y: THREE.MathUtils.lerp(prev.y, joint.y, alpha),
        z: THREE.MathUtils.lerp(prev.z, joint.z, alpha),
        screenX: currScreenX !== null && prevScreenX !== null 
          ? THREE.MathUtils.lerp(prevScreenX, currScreenX, alpha) 
          : currScreenX ?? undefined,
        screenY: currScreenY !== null && prevScreenY !== null 
          ? THREE.MathUtils.lerp(prevScreenY, currScreenY, alpha) 
          : currScreenY ?? undefined,
        visibility: joint.visibility ?? prev.visibility ?? 1,
      };
    });

    return smoothedJoints.current;
  };

  useEffect(() => {
    window.receiveRNPose = (joints) => {
      latestJoints.current = smoothPose(joints);
    };

    window.resetAvatarCalibration = () => {
      calibrationRef.current = null;
      squatAmountRef.current = 0;
      trackingOriginRef.current = null;
    };

    const isLiveMode =
      new URLSearchParams(window.location.search).get('mode') === 'live' ||
      !!latestJoints.current;

    if (isLiveMode && mixer) {
      mixer.stopAllAction();
    }

    return () => {
      delete window.receiveRNPose;
      delete window.resetAvatarCalibration;
    };
  }, [mixer]);

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
          if (child.isBone && (child.name.toLowerCase().includes(standardName.toLowerCase().replace("mixamorig", "")) 
              || fallbacks.some(f => child.name.toLowerCase().includes(f.toLowerCase())))) {
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

      bonesRef.current.leftShoulder = storeBone("leftShoulder", getBone("mixamorigLeftShoulder", ["LeftShoulder", "leftShoulder", "Clavicle_L"]));
      bonesRef.current.rightShoulder = storeBone("rightShoulder", getBone("mixamorigRightShoulder", ["RightShoulder", "rightShoulder", "Clavicle_R"]));
      bonesRef.current.leftArm = storeBone("leftArm", getBone("mixamorigLeftArm", ["LeftArm", "leftArm", "Arm_L"]));
      bonesRef.current.leftForeArm = storeBone("leftForeArm", getBone("mixamorigLeftForeArm", ["LeftForeArm", "leftForeArm", "ForeArm_L"]));
      bonesRef.current.rightArm = storeBone("rightArm", getBone("mixamorigRightArm", ["RightArm", "rightArm", "Arm_R"]));
      bonesRef.current.rightForeArm = storeBone("rightForeArm", getBone("mixamorigRightForeArm", ["RightForeArm", "rightForeArm", "ForeArm_R"]));
      bonesRef.current.spine = storeBone("spine", getBone("mixamorigSpine", ["Spine", "spine", "Spine1", "Spine2", "mixamorigSpine1"]));
      bonesRef.current.hips = storeBone("hips", getBone("mixamorigHips", ["Hips", "hips", "Pelvis"]));
      bonesRef.current.leftUpLeg = storeBone("leftUpLeg", getBone("mixamorigLeftUpLeg", ["LeftUpLeg", "leftUpLeg", "Thigh_L"]));
      bonesRef.current.leftLeg = storeBone("leftLeg", getBone("mixamorigLeftLeg", ["LeftLeg", "leftLeg", "Shin_L"]));
      bonesRef.current.rightUpLeg = storeBone("rightUpLeg", getBone("mixamorigRightUpLeg", ["RightUpLeg", "rightUpLeg", "Thigh_R"]));
      bonesRef.current.rightLeg = storeBone("rightLeg", getBone("mixamorigRightLeg", ["RightLeg", "rightLeg", "Shin_R"]));
      bonesRef.current.neck = storeBone("neck", getBone("mixamorigNeck", ["Neck", "neck", "Neck1", "mixamorigSpine2"]));
      bonesRef.current.head = storeBone("head", getBone("mixamorigHead", ["Head", "head", "mixamorigHeadTop_End"]));
      bonesRef.current.leftHand = storeBone("leftHand", getBone("mixamorigLeftHand", ["LeftHand", "leftHand", "Hand_L"]));
      bonesRef.current.rightHand = storeBone("rightHand", getBone("mixamorigRightHand", ["RightHand", "rightHand", "Hand_R"]));
      bonesRef.current.leftFoot = storeBone("leftFoot", getBone("mixamorigLeftFoot", ["LeftFoot", "leftFoot", "Foot_L", "LeftToeBase"]));
      bonesRef.current.rightFoot = storeBone("rightFoot", getBone("mixamorigRightFoot", ["RightFoot", "rightFoot", "Foot_R", "RightToeBase"]));
    }
  }, [scene, nodes]);

  useEffect(() => {
    if (group.current) {
      baseGroupPosition.current.copy(group.current.position);
      baseGroupRotation.current.copy(group.current.rotation);
    }
    
    window.receiveRNMessage = (data) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.type === 'LIVE_POSE') {
        latestJoints.current = smoothPose(parsed.joints);
      }
    };

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WEBVIEW_READY' }));
    }
  }, []);

  const resetBoneToRest = (bone) => {
    if (!bone || !bone.userData.baseQuaternion) return;
    bone.quaternion.slerp(bone.userData.baseQuaternion, 0.12);
  };

  const resetBonePosition = (bone, speed = 0.12) => {
    if (!bone?.userData.basePosition) return;
    bone.position.lerp(bone.userData.basePosition, speed);
  };

  const applySquatBend = (bone, axis, angle, speed = 0.16) => {
    if (!bone?.userData.baseQuaternion) return;
    const bendQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    bone.quaternion.slerp(
      bone.userData.baseQuaternion.clone().multiply(bendQuat),
      speed
    );
  };

  const wrapAngle = (angle) => ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;

  const isVisible = (id) => {
    const joint = latestJoints.current?.[id];
    if (!joint) return false;
    return joint.visibility === undefined || joint.visibility > 0.35;
  };

  const getJoint = (id) => latestJoints.current?.[id];

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

    if (
      lHip && rHip && lShoulder && rShoulder &&
      isVisible(MP.L_HIP) && isVisible(MP.R_HIP) &&
      isVisible(MP.L_SHOULDER) && isVisible(MP.R_SHOULDER)
    ) {
      const hips = midpoint(lHip, rHip);
      const shoulders = midpoint(lShoulder, rShoulder);
      return midpoint(hips, shoulders);
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

    const localDir = worldDir.clone().normalize();
    if (bone.parent) {
      bone.parent.updateMatrixWorld(true);
      const parentWorldQuat = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(parentWorldQuat);
      localDir.applyQuaternion(parentWorldQuat.invert());
    }

    const restDir = bone.userData.baseDirection || new THREE.Vector3(0, 1, 0).applyQuaternion(bone.userData.baseQuaternion || new THREE.Quaternion().identity());
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(restDir, localDir);
    const baseQuaternion = bone.userData.baseQuaternion || new THREE.Quaternion().identity();
    bone.quaternion.slerp(baseQuaternion.clone().multiply(targetQuaternion), speed);
  };

  const clampDirectionFromRest = (bone, worldDir, maxAngle) => {
    if (!bone || !worldDir || worldDir.lengthSq() < 0.00001) return worldDir;

    const localDir = worldDir.clone().normalize();

    if (bone.parent) {
      bone.parent.updateMatrixWorld(true);
      const parentWorldQuat = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(parentWorldQuat);
      localDir.applyQuaternion(parentWorldQuat.invert());
    }

    const restDir = bone.userData.baseDirection || new THREE.Vector3(0, 1, 0);
    const angle = restDir.angleTo(localDir);

    if (angle <= maxAngle) return worldDir;

    const limitedLocalDir = restDir.clone().slerp(localDir, maxAngle / angle).normalize();

    if (bone.parent) {
      const parentWorldQuat = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(parentWorldQuat);
      limitedLocalDir.applyQuaternion(parentWorldQuat);
    }

    return limitedLocalDir;
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

    const worldDir = new THREE.Vector3(
      end.x - start.x,
      -(end.y - start.y),
      -(end.z - start.z)
    );

    applyBoneDirection(bone, clampDirectionFromRest(bone, worldDir, maxAngle), speed);
  };

  const orientBone = (bone, startId, endId, speed = 0.25) => {
    if (!bone) return;

    const joints = latestJoints.current;
    if (!joints?.[startId] || !joints?.[endId] || !isVisible(startId) || !isVisible(endId)) {
      resetBoneToRest(bone);
      return;
    }

    const start = joints[startId];
    const end = joints[endId];

    const worldDir = new THREE.Vector3(
      end.x - start.x,
      -(end.y - start.y),
      -(end.z - start.z)
    );

    applyBoneDirection(bone, worldDir, speed);
  };  

  useEffect(() => {
    function download() {
      const exporter = new GLTFExporter();
      exporter.parse(
        group.current,
        async function (result) {
          const io = new NodeIO();
          const document = await io.readBinary(new Uint8Array(result)); 
          await document.transform(prune(), dedup(), draco(), quantize());
          const glb = await io.writeBinary(document); 
          save(new Blob([glb], { type: "application/octet-stream" }), `avatar_${+ new Date()}.glb`);
        },
        function (error) { console.error(error); },
        { binary: true }
      );
    }
    const link = document.createElement("a");
    link.style.display = "none";
    document.body.appendChild(link);
    function save(blob, filename) {
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    }
    setDownload(download);
  }, [setDownload]);

  useEffect(() => {
    const isLiveMode =
      new URLSearchParams(window.location.search).get('mode') === 'live' ||
      !!latestJoints.current;

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

      const isLiveMode =
        new URLSearchParams(window.location.search).get('mode') === 'live' ||
        !!latestJoints.current;

      const torsoVisible = isLiveMode && hasStableTorso();
      torsoVisibleRef.current = torsoVisible;

      // --- SQUAT & ANCHORED SCREEN-SPACE TRACKING ---
      if (isLiveMode && latestJoints.current?.[MP.L_HIP] && latestJoints.current?.[MP.R_HIP]) {
        const bodyCenter = getBodyCenter();

        if (bodyCenter) {
          const centerScreenX = getScreenX(bodyCenter);
          const centerScreenY = getScreenY(bodyCenter);

          if (!trackingOriginRef.current && centerScreenX !== null && centerScreenY !== null) {
            trackingOriginRef.current = {
              screenX: centerScreenX,
              screenY: centerScreenY,
            };
          }

          let crouchAmount = 0;
          const lHip = latestJoints.current[MP.L_HIP];
          const rHip = latestJoints.current[MP.R_HIP];

          const lHipScreenY = getScreenY(lHip);
          const rHipScreenY = getScreenY(rHip);

          if (lHipScreenY !== null && rHipScreenY !== null) {
            const currentHipY = (lHipScreenY + rHipScreenY) / 2;

            if (!calibrationRef.current) {
              calibrationRef.current = {
                standingHipY: currentHipY,
                standingTorsoHeight: 0.25,
              };
            }

            let standingHipY = calibrationRef.current.standingHipY;

            if (currentHipY < standingHipY) {
              calibrationRef.current.standingHipY = THREE.MathUtils.lerp(
                standingHipY,
                currentHipY,
                0.15
              );
              standingHipY = calibrationRef.current.standingHipY;
            }

            const hipDrop = currentHipY - standingHipY;

            crouchAmount = THREE.MathUtils.clamp(
              hipDrop / 0.10,
              0,
              0.85
            );
          }

          squatAmountRef.current = THREE.MathUtils.lerp(
            squatAmountRef.current,
            crouchAmount,
            0.18
          );

          liveGroupPosition.current.x = 0;
          liveGroupPosition.current.y = LIVE_AVATAR_BASE_Y;
          liveGroupPosition.current.z = 0.02;

          if (bones.hips?.userData.basePosition) {
            const targetHipPosition = bones.hips.userData.basePosition.clone();
            targetHipPosition.y -= squatAmountRef.current * 4;
            targetHipPosition.z += squatAmountRef.current * 1;

            bones.hips.position.lerp(targetHipPosition, 0.12);
          }

          // Shoulder tilt
          const lShoulder = latestJoints.current[MP.L_SHOULDER];
          const rShoulder = latestJoints.current[MP.R_SHOULDER];
          const lShoulderScreenY = getScreenY(lShoulder);
          const rShoulderScreenY = getScreenY(rShoulder);

          if (lShoulderScreenY !== null && rShoulderScreenY !== null && bones.leftShoulder && bones.rightShoulder) {
            const shoulderTilt = lShoulderScreenY - rShoulderScreenY;
            const tiltAmount = THREE.MathUtils.clamp(shoulderTilt * 1.8, -0.35, 0.35);

            const leftBaseQuat = bones.leftShoulder.userData.baseQuaternion;
            const rightBaseQuat = bones.rightShoulder.userData.baseQuaternion;

            if (leftBaseQuat && rightBaseQuat) {
              const leftTiltQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -tiltAmount);
              const rightTiltQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -tiltAmount);

              bones.leftShoulder.quaternion.slerp(leftBaseQuat.clone().multiply(leftTiltQuat), 0.12);
              bones.rightShoulder.quaternion.slerp(rightBaseQuat.clone().multiply(rightTiltQuat), 0.12);
            }
          }
        } else {
          liveGroupPosition.current.set(0, LIVE_AVATAR_BASE_Y, 0.02);
          resetBonePosition(bones.hips, 0.18);

          squatAmountRef.current = THREE.MathUtils.lerp(
            squatAmountRef.current,
            0,
            0.12
          );
        }
      }

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

      if (!latestJoints.current) {
        Object.values(bones).forEach(resetBoneToRest);
        resetBonePosition(bones.hips, 0.18);
        bones.hips?.updateMatrixWorld(true);
        nodes.Plane.skeleton.update();
        return;
      }

      // --- UPPER BODY TRACKING ---
      orientBoneSafe(bones.leftArm, MP.L_SHOULDER, MP.L_ELBOW, 0.12, THREE.MathUtils.degToRad(115));
      orientBoneSafe(bones.leftForeArm, MP.L_ELBOW, MP.L_WRIST, 0.14, THREE.MathUtils.degToRad(145));
      orientBoneSafe(bones.rightArm, MP.R_SHOULDER, MP.R_ELBOW, 0.12, THREE.MathUtils.degToRad(115));
      orientBoneSafe(bones.rightForeArm, MP.R_ELBOW, MP.R_WRIST, 0.14, THREE.MathUtils.degToRad(145));

      resetBoneToRest(bones.leftHand);
      resetBoneToRest(bones.rightHand);

      // --- LOWER BODY LEG ORIENTATION TRANSFORMS ---
      if (!isLiveMode) {
        orientBone(bones.leftUpLeg, MP.L_HIP, MP.L_KNEE, 0.08);
        orientBone(bones.leftLeg, MP.L_KNEE, MP.L_ANKLE, 0.06);
        orientBone(bones.rightUpLeg, MP.R_HIP, MP.R_KNEE, 0.08);
        orientBone(bones.rightLeg, MP.R_KNEE, MP.R_ANKLE, 0.06);
      }

      orientBone(bones.leftFoot, MP.L_ANKLE, MP.L_FOOT_INDEX, 0.06);
      orientBone(bones.rightFoot, MP.R_ANKLE, MP.R_FOOT_INDEX, 0.06);

      // --- SPINE & TORSO ROTATIONS ---
      if (
        bones.spine && 
        latestJoints.current[MP.L_SHOULDER] && 
        latestJoints.current[MP.R_SHOULDER] && 
        latestJoints.current[MP.L_HIP] && 
        latestJoints.current[MP.R_HIP] &&
        isVisible(MP.L_SHOULDER) &&
        isVisible(MP.R_SHOULDER) &&
        isVisible(MP.L_HIP) &&
        isVisible(MP.R_HIP)
      ) {
        const lShoulder = latestJoints.current[MP.L_SHOULDER];
        const rShoulder = latestJoints.current[MP.R_SHOULDER];
        const lHip = latestJoints.current[MP.L_HIP];
        const rHip = latestJoints.current[MP.R_HIP];

        const midShoulder = {
          x: (lShoulder.x + rShoulder.x) / 2,
          y: (lShoulder.y + rShoulder.y) / 2,
          z: (lShoulder.z + rShoulder.z) / 2
        };
        const midHip = {
          x: (lHip.x + rHip.x) / 2,
          y: (lHip.y + rHip.y) / 2,
          z: (lHip.z + rHip.z) / 2
        };

        // 1. Spine Lean / Tilt (Pitch & Roll)
        const torsoDir = new THREE.Vector3(
          (midShoulder.x - midHip.x) * 0.12,
          0.9 + (-(midShoulder.y - midHip.y) * 0.03),
          (-(midShoulder.z - midHip.z)) * 0.12
        );

        if (torsoDir.lengthSq() > 0.00001) {
          applyBoneDirection(bones.spine, torsoDir, 0.005);
        }

        // 2. True Body Turning (Yaw)
        if (torsoVisible && group.current) {
          const shoulderDx = lShoulder.x - rShoulder.x;
          const hipDx = lHip.x - rHip.x;
          const bodyDx = (shoulderDx + hipDx) * 0.5;

          // Scale up depth (Z) to match screen X coordinates
          const Z_SCALE = 3.0;
          const shoulderDz = -(lShoulder.z - rShoulder.z) * Z_SCALE;
          const hipDz = -(lHip.z - rHip.z) * Z_SCALE;
          const bodyDz = (shoulderDz + hipDz) * 0.5;

          let rawYaw = 0;

          // Use depth if Z tracking is active
          if (Math.abs(bodyDz) > 0.001) {
            rawYaw = Math.atan2(bodyDz, bodyDx);
          } else {
            // Fallback for flat Z: turn using nose position relative to shoulders
            const nose = latestJoints.current[MP.NOSE];
            if (nose) {
              const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
              const shoulderWidth = Math.abs(bodyDx) || 0.2;
              const noseOffset = (nose.x - shoulderMidX) / shoulderWidth;
              rawYaw = THREE.MathUtils.clamp(noseOffset * 1.2, -0.8, 0.8);
            }
          }

          const DEADZONE = THREE.MathUtils.degToRad(2.5); // Reduced deadzone
          const MAX_YAW = THREE.MathUtils.degToRad(50);    // Max allowed body turn angle

          let desiredYaw = 0;
          if (Math.abs(rawYaw) > DEADZONE) {
            desiredYaw = rawYaw;
          }

          desiredYaw = THREE.MathUtils.clamp(desiredYaw, -MAX_YAW, MAX_YAW);

          turnTargetRef.current = THREE.MathUtils.lerp(
            turnTargetRef.current,
            desiredYaw,
            0.15
          );
        }
      } else {
        resetBoneToRest(bones.spine);
        turnTargetRef.current = THREE.MathUtils.lerp(turnTargetRef.current, 0, 0.1);
      }

      // --- NECK TRACKING ---
      if (
        bones.neck && 
        latestJoints.current[MP.L_SHOULDER] && 
        latestJoints.current[MP.R_SHOULDER] && 
        latestJoints.current[MP.NOSE] &&
        isVisible(MP.L_SHOULDER) &&
        isVisible(MP.R_SHOULDER) &&
        isVisible(MP.NOSE)
      ) {
        const midShoulder = {
          x: (latestJoints.current[MP.L_SHOULDER].x + latestJoints.current[MP.R_SHOULDER].x) / 2,
          y: (latestJoints.current[MP.L_SHOULDER].y + latestJoints.current[MP.R_SHOULDER].y) / 2,
          z: (latestJoints.current[MP.L_SHOULDER].z + latestJoints.current[MP.R_SHOULDER].z) / 2
        };
        const nose = latestJoints.current[MP.NOSE];

        const neckDir = new THREE.Vector3(
          (nose.x - midShoulder.x) * 0.01,
          -(nose.y - midShoulder.y) * 0.15,
          -(nose.z - midShoulder.z) * 0.01
        );

        if (neckDir.lengthSq() > 0.00001) {
          applyBoneDirection(bones.neck, neckDir, 0.02);
        }
      } else {
        resetBoneToRest(bones.neck);
      }

      // --- HEAD TRACKING ---
      if (
        bones.head && 
        latestJoints.current[MP.L_EYE] && 
        latestJoints.current[MP.R_EYE] && 
        latestJoints.current[MP.NOSE] &&
        isVisible(MP.L_EYE) &&
        isVisible(MP.R_EYE) &&
        isVisible(MP.NOSE)
      ) {
        const leftEye = latestJoints.current[MP.L_EYE];
        const rightEye = latestJoints.current[MP.R_EYE];
        const nose = latestJoints.current[MP.NOSE];

        const headDir = new THREE.Vector3(
          (rightEye.x - leftEye.x) * 0.005,
          0,
          -(nose.z - (leftEye.z + rightEye.z) / 2) * 0.005
        );

        if (headDir.lengthSq() > 0.00001) {
          applyBoneDirection(bones.head, headDir, 0.025);
        }
      } else {
        resetBoneToRest(bones.head);
      }

      if (isLiveMode && group.current) {
        if (torsoVisibleRef.current) {
          const yawDelta = wrapAngle(turnTargetRef.current - group.current.rotation.y);
          group.current.rotation.y += yawDelta * 0.12; 
        } else {
          turnTargetRef.current = THREE.MathUtils.lerp(turnTargetRef.current, 0, 0.08);
          group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.08);
        }
      }

      if (!isLiveMode) {
        resetBoneToRest(bones.hips);
      }

      // --- SQUAT BENDING (LIVE MODE) ---
      if (isLiveMode) {
        const squat = squatAmountRef.current;

        const thighBend = squat * THREE.MathUtils.degToRad(52);
        const shinBend = squat * THREE.MathUtils.degToRad(65);
        const torsoLean = squat * THREE.MathUtils.degToRad(8);

        const bendAxis = new THREE.Vector3(1, 0, 0);

        applySquatBend(bones.leftUpLeg, bendAxis, -thighBend, 0.18);
        applySquatBend(bones.rightUpLeg, bendAxis, -thighBend, 0.18);

        applySquatBend(bones.leftLeg, bendAxis, shinBend, 0.18);
        applySquatBend(bones.rightLeg, bendAxis, shinBend, 0.18);

        applySquatBend(bones.spine, bendAxis, torsoLean, 0.1);
      }

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

useGLTF.preload('/models/Armature.glb');
