import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PoseLandmark } from '../types';
import {
  BoneMap,
  captureRestPose,
  countMappedBones,
  mapBones,
  PoseRigState,
  RestPose,
  updateAvatarPose,
} from '../utils/postureRules';

// The web avatar overlay uses Three.js and the public GLB asset path.
type AvatarPoseOverlayProps = {
  landmarks: PoseLandmark[];
  avatarUrl?: string;
};

const DEFAULT_AVATAR_URL = '/avatars/avatar_test.glb';
const TARGET_MODEL_HEIGHT = 1.55;

const getAvatarFacingRotation = () => {
  if (typeof window === 'undefined') {
    return 0;
  }
  return new URLSearchParams(window.location.search).get('avatarFacing') === 'back' ? Math.PI : 0;
};

export default function AvatarPoseOverlay({
  landmarks,
  avatarUrl = DEFAULT_AVATAR_URL,
}: AvatarPoseOverlayProps) {
  // DOM and Three.js refs let the render loop run outside normal React state updates.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const avatarRef = useRef<any>(null);
  const bonesRef = useRef<BoneMap>({});
  const restPoseRef = useRef<RestPose>({});
  const rigStateRef = useRef<PoseRigState>({});
  const threeRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);
  const landmarksRef = useRef<PoseLandmark[]>(landmarks);
  const [useSkeletonFallback, setUseSkeletonFallback] = useState(false);
  const [status, setStatus] = useState('Loading avatar...');
  const [isPoseDriving, setIsPoseDriving] = useState(false);

  useEffect(() => {
    // Keep the animation loop pointed at the newest landmarks.
    landmarksRef.current = landmarks;
  }, [landmarks]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !hostRef.current) {
      return undefined;
    }

    let disposed = false;

    const start = async () => {
      try {
        // Import Three only on web so native bundles use the native overlay instead.
        const THREE = await import('three');
        threeRef.current = THREE;
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const host = hostRef.current;
        if (!host || disposed) {
          return;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(28, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 100);
        camera.position.set(0, 0, 4.8);
        camera.lookAt(0, 0, 0);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.pointerEvents = 'none';
        host.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 1.5));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(1.5, 3, 4);
        scene.add(keyLight);

        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(avatarUrl);
        if (disposed) {
          return;
        }
        const avatar = gltf.scene;
        avatar.rotation.y = getAvatarFacingRotation();
        avatar.updateMatrixWorld(true);

        // GLB authors export at different origins and scales, so center every model first.
        const box = new THREE.Box3().setFromObject(avatar);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const fitScale = TARGET_MODEL_HEIGHT / Math.max(0.001, size.y);
        avatar.scale.setScalar(fitScale);
        avatar.position.set(-center.x * fitScale, -center.y * fitScale, -center.z * fitScale);

        const avatarGroup = new THREE.Group();
        avatarGroup.position.set(0, 0.02, 0);
        avatarGroup.add(avatar);
        scene.add(avatarGroup);

        const bones = mapBones(avatarGroup);
        const restPose = captureRestPose(bones);
        const mappedBones = countMappedBones(bones);
        avatarRef.current = avatarGroup;
        bonesRef.current = bones;
        restPoseRef.current = restPose;
        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;
        setUseSkeletonFallback(mappedBones === 0);
        setStatus(mappedBones ? `Avatar loaded (${mappedBones} bones)` : 'Avatar rig unavailable; skeleton fallback');

        const animate = () => {
          if (!rendererRef.current || !sceneRef.current || !cameraRef.current || disposed) {
            return;
          }
          if (avatarRef.current && threeRef.current) {
            // Retarget the user's latest 33 landmarks onto the avatar's mapped bones.
            const didDrivePose = updateAvatarPose(
              threeRef.current,
              avatarRef.current,
              bonesRef.current,
              restPoseRef.current,
              landmarksRef.current,
              rigStateRef.current,
            );
            setIsPoseDriving((current) => (current === didDrivePose ? current : didDrivePose));
          }
          rendererRef.current.render(sceneRef.current, cameraRef.current);
          frameRef.current = requestAnimationFrame(animate);
        };

        animate();
      } catch (error) {
        // If web GLB loading fails, let the camera canvas keep showing the 33-point skeleton.
        setUseSkeletonFallback(true);
        setStatus('Avatar unavailable; skeleton fallback');
      }
    };

    start();

    const handleResize = () => {
      // Keep the WebGL canvas aligned with the camera preview size.
      const host = hostRef.current;
      if (!host || !rendererRef.current || !cameraRef.current) {
        return;
      }
      rendererRef.current.setSize(host.clientWidth, host.clientHeight);
      cameraRef.current.aspect = host.clientWidth / Math.max(1, host.clientHeight);
      cameraRef.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      setIsPoseDriving(false);
      rendererRef.current?.dispose?.();
      if (hostRef.current && rendererRef.current?.domElement?.parentNode === hostRef.current) {
        hostRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [avatarUrl]);

  if (Platform.OS !== 'web') {
    return null;
  }

  const trackingStatus = landmarks.length === 33
    ? isPoseDriving
      ? 'Avatar tracking camera pose'
      : `${status}; step fully into frame`
    : `${status}; waiting for camera pose`;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {React.createElement('div' as any, {
        ref: hostRef,
        style: {
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          display: useSkeletonFallback ? 'none' : 'block',
        },
      })}
      <View style={styles.statusPill}>
        <Text style={styles.statusText}>
          {useSkeletonFallback ? status : trackingStatus}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
  statusPill: {
    position: 'absolute',
    left: 12,
    top: 12,
    maxWidth: '70%',
    backgroundColor: 'rgba(17, 24, 39, 0.68)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
