import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AvatarProfileConfig, UserProfile, UserStats } from '../types';
import { getAvatarRenderUri } from '../services/avatarAssetStorage';

type AvatarShowcaseViewProps = {
  profile: UserProfile | null;
  stats: UserStats;
  avatarConfig: AvatarProfileConfig;
};

const TARGET_MODEL_HEIGHT = 1.65;

export default function AvatarShowcaseView({ avatarConfig }: AvatarShowcaseViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);
  const avatarUri = useMemo(() => getAvatarRenderUri(avatarConfig), [avatarConfig]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    let disposed = false;
    setFailed(false);

    const start = async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        if (disposed || !hostRef.current) {
          return;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x12101b);
        const camera = new THREE.PerspectiveCamera(24, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 100);
        camera.position.set(0, 0.1, 5.2);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        host.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        scene.add(new THREE.AmbientLight(0xffffff, 1.35));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
        keyLight.position.set(1.2, 3, 4);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x77d8ff, 1.1);
        rimLight.position.set(-3, 1.8, 2);
        scene.add(rimLight);

        const gltf = await new GLTFLoader().loadAsync(avatarUri);
        if (disposed) {
          return;
        }
        const avatar = gltf.scene;
        const box = new THREE.Box3().setFromObject(avatar);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const fitScale = TARGET_MODEL_HEIGHT / Math.max(0.001, size.y);
        avatar.scale.setScalar(fitScale);
        avatar.position.set(-center.x * fitScale, -center.y * fitScale - 0.1, -center.z * fitScale);

        const group = new THREE.Group();
        group.add(avatar);
        scene.add(group);

        const animate = () => {
          if (disposed) {
            return;
          }
          group.rotation.y += 0.004;
          renderer.render(scene, camera);
          frameRef.current = requestAnimationFrame(animate);
        };
        animate();
      } catch {
        setFailed(true);
      }
    };

    const handleResize = () => {
      const currentHost = hostRef.current;
      const renderer = rendererRef.current;
      if (!currentHost || !renderer) {
        return;
      }
      renderer.setSize(currentHost.clientWidth, currentHost.clientHeight);
    };

    start();
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', handleResize);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      rendererRef.current?.dispose?.();
      if (hostRef.current && rendererRef.current?.domElement?.parentNode === hostRef.current) {
        hostRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current = null;
    };
  }, [avatarUri]);

  return (
    <View style={styles.container}>
      {React.createElement('div' as any, {
        ref: hostRef,
        style: {
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        },
      })}
      {failed && (
        <View style={styles.fallback}>
          <View style={[styles.fallbackAvatar, { backgroundColor: avatarConfig.accentColor }]}>
            <Feather name="user-check" size={34} color="#fff" />
          </View>
          <Text style={styles.fallbackTitle}>{avatarConfig.label}</Text>
          <Text style={styles.fallbackCopy}>Default avatar active</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 360,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#12101B',
  },
  fallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: '#12101B',
  },
  fallbackAvatar: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  fallbackCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
});
