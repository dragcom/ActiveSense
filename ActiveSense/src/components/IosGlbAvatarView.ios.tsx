import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { toByteArray } from 'base64-js';
import type { Mesh, Object3D } from 'three';
import bundledDefaultAvatar from '../../public/avatars/avatar_test.glb';
import { AvatarProfileConfig, PoseLandmark } from '../types';
import {
  BoneMap,
  captureRestPose,
  countMappedBones,
  mapBones,
  PoseRigState,
  RestPose,
  updateAvatarPose,
} from '../utils/poseRig';

type IosGlbAvatarViewProps = {
  avatarConfig: AvatarProfileConfig;
  autoRotate?: boolean;
  landmarks?: PoseLandmark[];
  showStatus?: boolean;
  transparent?: boolean;
};

const TARGET_MODEL_HEIGHT = 1.65;

const isFileUri = (uri?: string) => Boolean(uri?.startsWith('file://'));
const isDefaultAvatarUri = (uri?: string) => Boolean(uri?.includes('/avatars/avatar_test.glb'));

const base64ToArrayBuffer = (base64: string) => {
  const bytes = toByteArray(base64);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return arrayBuffer;
};

const loadAvatarArrayBuffer = async (avatarConfig: AvatarProfileConfig) => {
  const sourceUri = avatarConfig.localAvatarUri || avatarConfig.avatarUrl;
  if (isFileUri(sourceUri)) {
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToArrayBuffer(base64);
  }

  if (!sourceUri || isDefaultAvatarUri(sourceUri)) {
    const asset = Asset.fromModule(bundledDefaultAvatar);
    await asset.downloadAsync();
    const localUri = asset.localUri || asset.uri;
    if (!localUri) {
      throw new Error('Bundled avatar asset is unavailable.');
    }
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToArrayBuffer(base64);
  }

  throw new Error('Avatar source is not available on this device yet.');
};

const createExpoCanvas = (gl: ExpoWebGLRenderingContext) => ({
  width: gl.drawingBufferWidth,
  height: gl.drawingBufferHeight,
  clientWidth: gl.drawingBufferWidth,
  clientHeight: gl.drawingBufferHeight,
  style: {},
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  getContext: () => gl,
});

const patchExpoGlContext = (gl: ExpoWebGLRenderingContext) => {
  const patchedGl = gl as ExpoWebGLRenderingContext & {
    getContextAttributes?: () => WebGLContextAttributes;
    getParameter: WebGLRenderingContext['getParameter'];
    getShaderPrecisionFormat?: WebGLRenderingContext['getShaderPrecisionFormat'];
  };
  const getParameter = patchedGl.getParameter.bind(gl);
  const getShaderPrecisionFormat = patchedGl.getShaderPrecisionFormat?.bind(gl);

  patchedGl.getContextAttributes ??= () => ({
    alpha: false,
    antialias: true,
    depth: true,
    failIfMajorPerformanceCaveat: false,
    powerPreference: 'default',
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
  });

  patchedGl.getParameter = ((parameter: number) => {
    switch (parameter) {
      case 0x1f02:
        return 'WebGL 1.0';
      case 0x8b8c:
        return 'WebGL GLSL ES 1.0';
      case 0x1f00:
        return 'Expo GL';
      case 0x1f01:
        return 'Expo GL Renderer';
      default:
        return getParameter(parameter);
    }
  }) as WebGLRenderingContext['getParameter'];

  patchedGl.getShaderPrecisionFormat = ((shaderType: number, precisionType: number) =>
    getShaderPrecisionFormat?.(shaderType, precisionType) ?? {
      precision: 23,
      rangeMin: 127,
      rangeMax: 127,
    }) as WebGLRenderingContext['getShaderPrecisionFormat'];

  return patchedGl;
};

const ensureNavigatorUserAgent = () => {
  const currentNavigator = globalThis.navigator as Navigator & { userAgent?: string };
  if (currentNavigator?.userAgent) {
    return;
  }

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      ...currentNavigator,
      userAgent: 'ReactNative',
    },
  });
};

const createRenderer = async (
  THREE: typeof import('three-ios'),
  gl: ExpoWebGLRenderingContext,
  canvas: ReturnType<typeof createExpoCanvas>,
  transparent: boolean,
) => {
  const patchedGl = patchExpoGlContext(gl);
  return new THREE.WebGLRenderer({
    canvas: canvas as unknown as HTMLCanvasElement,
    context: patchedGl as unknown as WebGLRenderingContext,
    antialias: true,
    alpha: transparent,
  });
};

const prepareMaterialForExpoGl = (material: any, accentColor: string) => {
  if (!material) {
    return material;
  }

  const prepared = material.clone?.() ?? material;
  if ('map' in prepared) prepared.map = null;
  if ('normalMap' in prepared) prepared.normalMap = null;
  if ('roughnessMap' in prepared) prepared.roughnessMap = null;
  if ('metalnessMap' in prepared) prepared.metalnessMap = null;
  if ('aoMap' in prepared) prepared.aoMap = null;
  if ('emissiveMap' in prepared) prepared.emissiveMap = null;

  if (prepared.name === 'DWI' && prepared.color) {
    prepared.color.set(accentColor || '#13c7b4');
  }

  prepared.needsUpdate = true;
  return prepared;
};

const applyVisibleMaterials = (avatar: Object3D, accentColor: string) => {
  let meshCount = 0;

  avatar.traverse((object: Object3D) => {
    if (!('isMesh' in object) || !object.isMesh) {
      return;
    }

    const mesh = object as Mesh;
    mesh.frustumCulled = false;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => prepareMaterialForExpoGl(material, accentColor))
      : prepareMaterialForExpoGl(mesh.material, accentColor);
    meshCount += 1;
  });

  return meshCount;
};

const parseGlb = async (GLTFLoader: any, avatarBuffer: ArrayBuffer) => {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes("THREE.GLTFLoader: Couldn't load texture")) {
      return;
    }
    originalError(...args);
  };

  try {
    return await new Promise<any>((resolve, reject) => {
      new GLTFLoader().parse(avatarBuffer, '', resolve, reject);
    });
  } finally {
    console.error = originalError;
  }
};

const renderWithoutExpoGlNoise = (renderFrame: () => void) => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes("EXGL: gl.pixelStorei() doesn't support this parameter yet")) {
      return;
    }
    originalLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('THREE.WebGLRenderer: EXT_color_buffer_float extension not supported')) {
      return;
    }
    originalWarn(...args);
  };

  try {
    renderFrame();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
};

export default function IosGlbAvatarView({
  avatarConfig,
  autoRotate = true,
  landmarks = [],
  showStatus = true,
  transparent = false,
}: IosGlbAvatarViewProps) {
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const cleanupCallbacksRef = useRef<Array<() => void>>([]);
  const landmarksRef = useRef<PoseLandmark[]>(landmarks);
  const bonesRef = useRef<BoneMap>({});
  const restPoseRef = useRef<RestPose>({});
  const rigStateRef = useRef<PoseRigState>({});
  const [status, setStatus] = useState('Loading GLB avatar...');

  useEffect(() => {
    landmarksRef.current = landmarks;
  }, [landmarks]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      cleanupCallbacksRef.current.forEach((cleanup) => cleanup());
      cleanupCallbacksRef.current = [];
    };
  }, []);

  const handleContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    const isUnmounted = () => !mountedRef.current;
    try {
      const THREE = await import('three-ios');
      if (isUnmounted()) {
        return;
      }
      const { GLTFLoader } = await import('three-ios/examples/jsm/loaders/GLTFLoader.js');
      if (isUnmounted()) {
        return;
      }
      const avatarBuffer = await loadAvatarArrayBuffer(avatarConfig);
      if (isUnmounted()) {
        return;
      }
      const canvas = createExpoCanvas(gl);
      const renderer = await createRenderer(THREE, gl, canvas, transparent);
      cleanupCallbacksRef.current.push(() => renderer.dispose());
      if (isUnmounted()) {
        renderer.dispose();
        return;
      }

      renderer.setClearColor(0x12101b, transparent ? 0 : 1);
      renderer.setPixelRatio(1);
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);

      const scene = new THREE.Scene();
      scene.background = transparent ? null : new THREE.Color(0x12101b);

      const camera = new THREE.PerspectiveCamera(
        24,
        gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight),
        0.1,
        100,
      );
      camera.position.set(0, transparent ? 0.18 : 0.1, transparent ? 7.4 : 5.2);
      camera.lookAt(0, transparent ? -0.05 : 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 1.25));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
      keyLight.position.set(1.2, 3, 4);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0x77d8ff, 0.9);
      rimLight.position.set(-3, 1.8, 2);
      scene.add(rimLight);

      ensureNavigatorUserAgent();
      const gltf = await parseGlb(GLTFLoader, avatarBuffer);
      if (isUnmounted()) {
        renderer.dispose();
        return;
      }

      const avatar = gltf.scene;
      const meshCount = applyVisibleMaterials(avatar, avatarConfig.accentColor);
      if (meshCount === 0) {
        throw new Error('GLB avatar loaded without renderable meshes.');
      }
      avatar.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(avatar);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const targetModelHeight = transparent ? 1.12 : TARGET_MODEL_HEIGHT;
      const fitScale = targetModelHeight / Math.max(0.001, size.y);
      avatar.scale.setScalar(fitScale);
      avatar.position.set(
        -center.x * fitScale,
        -center.y * fitScale + (transparent ? -0.22 : -0.08),
        -center.z * fitScale,
      );
      avatar.updateMatrixWorld(true);

      const group = new THREE.Group();
      group.add(avatar);
      scene.add(group);
      bonesRef.current = mapBones(group);
      restPoseRef.current = captureRestPose(bonesRef.current);
      const mappedBones = countMappedBones(bonesRef.current);

      const warmupMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.01, 0.01),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      warmupMesh.frustumCulled = false;
      scene.add(warmupMesh);
      if (!isUnmounted()) {
        setStatus(mappedBones ? '' : 'GLB avatar rig unavailable');
      }

      const render = () => {
        if (isUnmounted()) {
          return;
        }
        if (autoRotate) {
          group.rotation.y += 0.004;
        } else {
          updateAvatarPose(
            THREE,
            group,
            bonesRef.current,
            restPoseRef.current,
            landmarksRef.current,
            rigStateRef.current,
          );
        }
        renderWithoutExpoGlNoise(() => renderer.render(scene, camera));
        gl.endFrameEXP();
        frameRef.current = requestAnimationFrame(render);
      };
      render();
    } catch (error) {
      if (isUnmounted()) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn('iOS GLB avatar render failed', message);
      setStatus(`GLB avatar unavailable: ${message.slice(0, 80)}`);
      gl.clearColor(0.07, 0.06, 0.11, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.endFrameEXP();
    }
  }, [autoRotate, avatarConfig, transparent]);

  return (
    <View style={[styles.container, transparent && styles.transparentContainer]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={handleContextCreate} />
      {showStatus && !!status && (
        <View style={styles.statusPanel}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: '#12101B',
  },
  transparentContainer: {
    backgroundColor: 'transparent',
  },
  statusPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#12101B',
  },
  statusText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
