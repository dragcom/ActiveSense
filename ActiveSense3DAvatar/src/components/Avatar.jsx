import { Suspense, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber"; 
import * as THREE from 'three'; 
import { useGLTF, useAnimations } from "@react-three/drei";
import { useConfiguratorStore, pb } from "../store";
import { Asset } from "./Asset";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { prune, dedup, draco, quantize } from "@gltf-transform/functions";
import { NodeIO } from "@gltf-transform/core";

// All 33 MediaPipe Pose Landmarks
const MP = {
  // Head & Face
  NOSE: 0,
  L_EYE_INNER: 1,    L_EYE: 2,           L_EYE_OUTER: 3,
  R_EYE_INNER: 4,    R_EYE: 5,           R_EYE_OUTER: 6,
  L_EAR: 7,          R_EAR: 8,
  MOUTH_LEFT: 9,     MOUTH_RIGHT: 10,
  // Upper Body
  L_SHOULDER: 11,    R_SHOULDER: 12,
  L_ELBOW: 13,       R_ELBOW: 14,
  L_WRIST: 15,       R_WRIST: 16,
  // Hands
  L_PINKY: 17,       L_INDEX: 18,        L_THUMB: 19,
  R_PINKY: 20,       R_INDEX: 21,        R_THUMB: 22,
  // Lower Body
  L_HIP: 23,         R_HIP: 24,
  L_KNEE: 25,        R_KNEE: 26,
  L_ANKLE: 27,       R_ANKLE: 28,
  // Feet
  L_HEEL: 29,        L_FOOT_INDEX: 30,
  R_HEEL: 31,        R_FOOT_INDEX: 32
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
  const frameCounter = useRef(0);
  const baseGroupPosition = useRef(new THREE.Vector3());
  const baseGroupRotation = useRef(new THREE.Euler());
  const liveGroupPosition = useRef(new THREE.Vector3(0, 0.5, 0.02));
  const liveGroupRotation = useRef(new THREE.Euler(-0.02, 0, 0));
  const turnTargetRef = useRef(0);

  // All 33-point bone tracking for complete body mirroring
  const bonesRef = useRef({
    // Head & Neck
    neck: null,
    head: null,
    // Upper Body
    leftArm: null,
    leftForeArm: null,
    rightArm: null,
    rightForeArm: null,
    // Hands
    leftHand: null,
    rightHand: null,
    // Torso
    spine: null,
    hips: null,
    // Lower Body
    leftUpLeg: null,
    leftLeg: null,
    rightUpLeg: null,
    rightLeg: null,
    // Feet
    leftFoot: null,
    rightFoot: null
  });

  useEffect(() => {
    window.receiveRNPose = (joints) => {
      latestJoints.current = joints;
    };
    const isLiveMode = new URLSearchParams(window.location.search).get('mode') === 'live';
    if (isLiveMode && mixer) {
      mixer.stopAllAction();
    }
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
          bone.userData.baseDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(bone.userData.baseQuaternion);
        }
        bonesRef.current[key] = bone;
        return bone;
      };

      bonesRef.current.leftArm = storeBone("leftArm", getBone("mixamorigLeftArm", ["mixamorigLeftShoulder", "LeftArm", "leftArm", "Arm_L"]));
      bonesRef.current.leftForeArm = storeBone("leftForeArm", getBone("mixamorigLeftForeArm", ["LeftForeArm", "leftForeArm", "ForeArm_L"]));
      bonesRef.current.rightArm = storeBone("rightArm", getBone("mixamorigRightArm", ["mixamorigRightShoulder", "RightArm", "rightArm", "Arm_R"]));
      bonesRef.current.rightForeArm = storeBone("rightForeArm", getBone("mixamorigRightForeArm", ["RightForeArm", "rightForeArm", "ForeArm_R"]));
      bonesRef.current.spine = storeBone("spine", getBone("mixamorigSpine", ["Spine", "spine", "Spine1", "Spine2", "mixamorigSpine1"]));
      bonesRef.current.hips = storeBone("hips", getBone("mixamorigHips", ["Hips", "hips", "Pelvis"]));

      // Dynamic discovery initialization mapping for leg sets
      bonesRef.current.leftUpLeg = storeBone("leftUpLeg", getBone("mixamorigLeftUpLeg", ["LeftUpLeg", "leftUpLeg", "Thigh_L"]));
      bonesRef.current.leftLeg = storeBone("leftLeg", getBone("mixamorigLeftLeg", ["LeftLeg", "leftLeg", "Shin_L"]));
      bonesRef.current.rightUpLeg = storeBone("rightUpLeg", getBone("mixamorigRightUpLeg", ["RightUpLeg", "rightUpLeg", "Thigh_R"]));
      bonesRef.current.rightLeg = storeBone("rightLeg", getBone("mixamorigRightLeg", ["RightLeg", "rightLeg", "Shin_R"]));

      // Head & Neck tracking for complete body mirroring
      bonesRef.current.neck = storeBone("neck", getBone("mixamorigNeck", ["Neck", "neck", "Neck1", "mixamorigSpine2"]));
      bonesRef.current.head = storeBone("head", getBone("mixamorigHead", ["Head", "head", "mixamorigHeadTop_End"]));

      // Hand tracking for gesture mirroring
      bonesRef.current.leftHand = storeBone("leftHand", getBone("mixamorigLeftHand", ["LeftHand", "leftHand", "mixamorigLeftFinger"]));
      bonesRef.current.rightHand = storeBone("rightHand", getBone("mixamorigRightHand", ["RightHand", "rightHand", "mixamorigRightFinger"]));

      // Foot tracking for foot orientation
      bonesRef.current.leftFoot = storeBone("leftFoot", getBone("mixamorigLeftFoot", ["LeftFoot", "leftFoot", "Foot_L", "LeftToeBase"]));
      bonesRef.current.rightFoot = storeBone("rightFoot", getBone("mixamorigRightFoot", ["RightFoot", "rightFoot", "Foot_R", "RightToeBase"]));

      console.log("🧬 [Avatar WebView] All 33-Point Full Body Rigging Complete:", {
        neck: bonesRef.current.neck ? bonesRef.current.neck.name : "MISSING",
        head: bonesRef.current.head ? bonesRef.current.head.name : "MISSING",
        leftArm: bonesRef.current.leftArm ? bonesRef.current.leftArm.name : "MISSING",
        leftForeArm: bonesRef.current.leftForeArm ? bonesRef.current.leftForeArm.name : "MISSING",
        rightArm: bonesRef.current.rightArm ? bonesRef.current.rightArm.name : "MISSING",
        rightForeArm: bonesRef.current.rightForeArm ? bonesRef.current.rightForeArm.name : "MISSING",
        leftHand: bonesRef.current.leftHand ? bonesRef.current.leftHand.name : "MISSING",
        rightHand: bonesRef.current.rightHand ? bonesRef.current.rightHand.name : "MISSING",
        leftUpLeg: bonesRef.current.leftUpLeg ? bonesRef.current.leftUpLeg.name : "MISSING",
        leftLeg: bonesRef.current.leftLeg ? bonesRef.current.leftLeg.name : "MISSING",
        rightUpLeg: bonesRef.current.rightUpLeg ? bonesRef.current.rightUpLeg.name : "MISSING",
        rightLeg: bonesRef.current.rightLeg ? bonesRef.current.rightLeg.name : "MISSING",
        leftFoot: bonesRef.current.leftFoot ? bonesRef.current.leftFoot.name : "MISSING",
        rightFoot: bonesRef.current.rightFoot ? bonesRef.current.rightFoot.name : "MISSING",
        spine: bonesRef.current.spine ? bonesRef.current.spine.name : "MISSING",
        hips: bonesRef.current.hips ? bonesRef.current.hips.name : "MISSING",
      });
    }
  }, [scene, nodes]);

  useEffect(() => {
    if (group.current) {
      baseGroupPosition.current.copy(group.current.position);
      baseGroupRotation.current.copy(group.current.rotation);
    }

    console.log("[Avatar WebView] ThreeJS Engine Tick: Idle status. Awaiting coordinates...");
    
    window.receiveRNMessage = (data) => {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.type === 'LIVE_POSE') {
        latestJoints.current = parsed.joints;
        if (Math.random() < 0.01) {
          console.log(`[Avatar WebView] Webview client caught full array payload via bridge!`);
        }
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

  const wrapAngle = (angle) => ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;

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

    const restDir = bone.userData.baseDirection || new THREE.Vector3(0, 1, 0).applyQuaternion(bone.userData.baseQuaternion 
                    || new THREE.Quaternion().identity());
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(restDir, localDir);
    const baseQuaternion = bone.userData.baseQuaternion || new THREE.Quaternion().identity();
    bone.quaternion.slerp(baseQuaternion.clone().multiply(targetQuaternion), speed);
  };

  const orientBone = (bone, startId, endId, speed = 0.25) => {
    if (!bone) return;

    const joints = latestJoints.current;
    if (!joints?.[startId] || !joints?.[endId]) {
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

  // --- GLTF DOWNLOADER ---
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

  // --- ANIMATIONS TOGGLE CONTROL ---
  useEffect(() => {
    const isLiveMode = new URLSearchParams(window.location.search).get('mode') === 'live';
    if (isLiveMode) {
      mixer.stopAllAction(); 
      return;
    }
    if (actions[pose]) {
      actions[pose].reset().fadeIn(0.2).play();
      return () => actions[pose]?.fadeOut(0.2);
    }
  }, [actions, pose, mixer]);

  // --- LIVE RENDER ENGINE TRACKING LOOP ---
  useFrame(() => {
    frameCounter.current++;
    const shouldLogDiag = frameCounter.current % 180 === 0;

    if (!nodes.Plane?.skeleton) {
      if (shouldLogDiag) console.log("[Avatar WebView] useFrame aborted: nodes.Plane.skeleton is missing!");
      return;
    }

    try {
      const bones = bonesRef.current;
      const isLiveMode = new URLSearchParams(window.location.search).get('mode') === 'live';

      // --- UNRESTRICTED POSITION TRACKING (WALKING, JUMPING, CROUCHING) ---
      if (isLiveMode && latestJoints.current?.[MP.L_HIP] && latestJoints.current?.[MP.R_HIP]) {
        const leftHip = latestJoints.current[MP.L_HIP];
        const rightHip = latestJoints.current[MP.R_HIP];

        // Midpoint tracking calculation
        const hipX = (leftHip.x + rightHip.x) / 2;
        const hipY = (leftHip.y + rightHip.y) / 2;
        const hipZ = (leftHip.z + rightHip.z) / 2;

        // Configuration values - keep avatar centered horizontally, allow vertical movement only
        const scaleFactorY = 1.2;

        // Keep avatar centered on X and Z, only track vertical movement for crouch/jump
        liveGroupPosition.current.x = 0;
        liveGroupPosition.current.y = 0.5 + (0.5 - hipY) * scaleFactorY;
        liveGroupPosition.current.z = 0;
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
        resetBoneToRest(bones.neck);
        resetBoneToRest(bones.head);
        resetBoneToRest(bones.leftArm);
        resetBoneToRest(bones.leftForeArm);
        resetBoneToRest(bones.rightArm);
        resetBoneToRest(bones.rightForeArm);
        resetBoneToRest(bones.leftHand);
        resetBoneToRest(bones.rightHand);
        resetBoneToRest(bones.leftUpLeg);
        resetBoneToRest(bones.leftLeg);
        resetBoneToRest(bones.rightUpLeg);
        resetBoneToRest(bones.rightLeg);
        resetBoneToRest(bones.leftFoot);
        resetBoneToRest(bones.rightFoot);
        resetBoneToRest(bones.spine);
        bones.hips?.updateMatrixWorld(true);
        nodes.Plane.skeleton.update();
        return;
      }

      // Upper Body Transforms - minimal subtle movement
      orientBone(bones.leftArm, MP.L_SHOULDER, MP.L_ELBOW, 0.08);
      orientBone(bones.leftForeArm, MP.L_ELBOW, MP.L_WRIST, 0.06);
      orientBone(bones.rightArm, MP.R_SHOULDER, MP.R_ELBOW, 0.08);
      orientBone(bones.rightForeArm, MP.R_ELBOW, MP.R_WRIST, 0.06);

      // --- NEW: Hand & Finger Tracking for complete gesture mirroring ---
      orientBone(bones.leftHand, MP.L_WRIST, MP.L_INDEX, 0.06);
      orientBone(bones.rightHand, MP.R_WRIST, MP.R_INDEX, 0.06);

      // --- LOWER BODY LEG ORIENTATION TRANSFORMS ---
      orientBone(bones.leftUpLeg, MP.L_HIP, MP.L_KNEE, 0.08);
      orientBone(bones.leftLeg, MP.L_KNEE, MP.L_ANKLE, 0.06);
      orientBone(bones.rightUpLeg, MP.R_HIP, MP.R_KNEE, 0.08);
      orientBone(bones.rightLeg, MP.R_KNEE, MP.R_ANKLE, 0.06);

      // --- NEW: Foot Tracking for complete lower body ---
      orientBone(bones.leftFoot, MP.L_ANKLE, MP.L_FOOT_INDEX, 0.06);
      orientBone(bones.rightFoot, MP.R_ANKLE, MP.R_FOOT_INDEX, 0.06);

      // Spine & Torso Logic
      if (bones.spine && latestJoints.current[MP.L_SHOULDER] && latestJoints.current[MP.R_SHOULDER] && latestJoints.current[MP.L_HIP] && latestJoints.current[MP.R_HIP]) {
        const midShoulder = {
          x: (latestJoints.current[MP.L_SHOULDER].x + latestJoints.current[MP.R_SHOULDER].x) / 2,
          y: (latestJoints.current[MP.L_SHOULDER].y + latestJoints.current[MP.R_SHOULDER].y) / 2,
          z: (latestJoints.current[MP.L_SHOULDER].z + latestJoints.current[MP.R_SHOULDER].z) / 2
        };
        const midHip = {
          x: (latestJoints.current[MP.L_HIP].x + latestJoints.current[MP.R_HIP].x) / 2,
          y: (latestJoints.current[MP.L_HIP].y + latestJoints.current[MP.R_HIP].y) / 2,
          z: (latestJoints.current[MP.L_HIP].z + latestJoints.current[MP.R_HIP].z) / 2
        };

        const torsoDir = new THREE.Vector3(
          (midShoulder.x - midHip.x) * 0.12,
          0.9 + (-(midShoulder.y - midHip.y) * 0.03),
          (-(midShoulder.z - midHip.z)) * 0.12
        );

        if (torsoDir.lengthSq() > 0.00001) {
          applyBoneDirection(bones.spine, torsoDir, 0.005);
        }

        const shoulderHipVec = new THREE.Vector3(midShoulder.x - midHip.x, 0, -(midShoulder.z - midHip.z));
        if (!isLiveMode && shoulderHipVec.lengthSq() > 0.00001 && group.current) {
          const desiredYaw = Math.atan2(shoulderHipVec.x, shoulderHipVec.z);
          turnTargetRef.current = desiredYaw;
        }
      }

      // --- NEW: Head & Neck Tracking for complete head mirroring ---
      if (bones.neck && latestJoints.current[MP.L_SHOULDER] && latestJoints.current[MP.R_SHOULDER] && latestJoints.current[MP.NOSE]) {
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
      }

      // Head tracking using eye landmarks for natural head rotation
      if (bones.head && latestJoints.current[MP.L_EYE] && latestJoints.current[MP.R_EYE] && latestJoints.current[MP.NOSE]) {
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
      }

      if (isLiveMode && group.current) {
        const yawDelta = wrapAngle(turnTargetRef.current - group.current.rotation.y);
        group.current.rotation.y += yawDelta * 0.04;
      }

      if (bones.hips && latestJoints.current[MP.L_SHOULDER] && latestJoints.current[MP.R_SHOULDER]) {
        const shoulderVec = new THREE.Vector3(
          latestJoints.current[MP.R_SHOULDER].x - latestJoints.current[MP.L_SHOULDER].x,
          0,
          -(latestJoints.current[MP.R_SHOULDER].z - latestJoints.current[MP.L_SHOULDER].z)
        );

        if (shoulderVec.lengthSq() > 0.00001) {
          const yawAngle = Math.atan2(shoulderVec.x, shoulderVec.z) * 0.03;
          const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
          const baseHipsQuat = bones.hips.userData.baseQuaternion || new THREE.Quaternion().identity();
          bones.hips.quaternion.slerp(baseHipsQuat.clone().multiply(yawQuat), 0.008);
        }
      }

      if (bones.hips) bones.hips.updateMatrixWorld(true);
      nodes.Plane.skeleton.update();

    } catch (err) {
      console.warn("Realtime mapping step missed:", err);
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