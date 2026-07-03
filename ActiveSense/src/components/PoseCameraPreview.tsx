import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { PoseLandmark } from '../types';
import AvatarPoseOverlay from './AvatarPoseOverlay';
import PoseSkeletonOverlay from './PoseSkeletonOverlay';
import NativePoseCameraView, { isNativePoseCameraAvailable } from './native/NativePoseCameraView';

// Native PoseCameraPreview owns camera permission, native pose events, and overlay choice.
type PoseCameraPreviewProps = {
  enabled: boolean;
  onLandmarks?: (landmarks: PoseLandmark[]) => void;
  overlayMode?: 'avatar' | 'skeleton';
  avatarUrl?: string;
  presentation?: 'card' | 'fill';
};

export default function PoseCameraPreview({
  enabled,
  onLandmarks,
  overlayMode = 'avatar',
  avatarUrl,
  presentation = 'card',
}: PoseCameraPreviewProps) {
  // Expo Camera provides the permission flow even when the custom native view renders the preview.
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [cameraReady, setCameraReady] = useState(false);
  const [slowCamera, setSlowCamera] = useState(false);
  const [nativeStatus, setNativeStatus] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<PoseLandmark[]>([]);
  const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';
  const hasNativePose = isNativeMobile && isNativePoseCameraAvailable();

  useEffect(() => {
    // Pausing the preview clears landmarks so reps and overlays stop updating.
    if (!enabled) {
      setCameraReady(false);
      setSlowCamera(false);
      setLandmarks([]);
      onLandmarks?.([]);
    }
  }, [enabled, onLandmarks]);

  useEffect(() => {
    // Show a helpful notice if camera startup takes unusually long.
    if (!enabled || !permission?.granted || cameraReady) {
      return undefined;
    }
    const timer = setTimeout(() => setSlowCamera(true), 2500);
    return () => clearTimeout(timer);
  }, [cameraReady, enabled, permission?.granted]);

  if (!enabled) {
    // The parent can disable tracking while keeping the layout stable.
    return (
      <View style={[styles.nativePanel, presentation === 'fill' && styles.fillPanel]}>
        <Text style={styles.nativeTitle}>Camera Paused</Text>
        <Text style={styles.nativeCopy}>Turn on camera tracking to start the native workout preview.</Text>
      </View>
    );
  }

  if (!permission) {
    // Permission state loads asynchronously on both iOS and Android.
    return (
      <View style={[styles.nativePanel, presentation === 'fill' && styles.fillPanel]}>
        <Text style={styles.nativeTitle}>Preparing Camera</Text>
        <Text style={styles.nativeCopy}>Checking iOS camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // No camera frames are requested until the user grants permission.
    return (
      <View style={[styles.nativePanel, presentation === 'fill' && styles.fillPanel]}>
        <Feather name="camera" size={26} color={colors.primary.tealLight} />
        <Text style={styles.nativeTitle}>Camera Access Required</Text>
        <Text style={styles.nativeCopy}>ActiveSense needs the camera for local workout tracking.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.cameraPanel, presentation === 'fill' && styles.fillPanel]}>
      {hasNativePose ? (
        // The custom native view runs MediaPipe and emits 33 pose landmarks to JS.
        <NativePoseCameraView
          style={StyleSheet.absoluteFill}
          enabled={enabled}
          cameraFacing={facing === 'back' ? 'back' : 'front'}
          onLandmarks={(event) => {
            const landmarks = (event.nativeEvent.landmarks ?? []).slice(0, 33);
            setSlowCamera(false);
            setCameraReady(true);
            setLandmarks(landmarks);
            onLandmarks?.(landmarks);
          }}
          onStatus={(event) => {
            const status = event.nativeEvent.status ?? null;
            setNativeStatus(status);
            if (status === 'native-pose-running' || status === 'native-pose-ready') {
              setSlowCamera(false);
              setCameraReady(true);
            }
          }}
        />
      ) : (
        // Plain CameraView is a graceful fallback when the native pose module is unavailable.
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing}
          mirror={facing === 'front'}
          onCameraReady={() => {
            setSlowCamera(false);
            setCameraReady(true);
          }}
        />
      )}

      {/* Avatar mode uses the rigged GLB first and skeleton fallback when needed. */}
      {overlayMode === 'avatar' && (
        <AvatarPoseOverlay landmarks={landmarks} avatarUrl={avatarUrl} mirrored={facing === 'front'} />
      )}
      {/* Skeleton mode keeps the original 33-point stick figure visible. */}
      {overlayMode === 'skeleton' && <PoseSkeletonOverlay landmarks={landmarks} mirrored={facing === 'front'} />}

      {slowCamera && !cameraReady && (
        <View style={styles.simulatorNotice}>
          <Feather name="camera-off" size={24} color="#fff" />
          <Text style={styles.simulatorTitle}>
            {hasNativePose ? 'Waiting for iPhone camera' : 'Native pose runtime unavailable'}
          </Text>
          <Text style={styles.simulatorCopy}>
            {hasNativePose
              ? 'Use a physical iPhone if the simulator cannot provide live frames.'
              : 'Build a custom iOS dev client to run MediaPipe and receive 33 pose points.'}
          </Text>
        </View>
      )}

      {presentation === 'card' && (
        <>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>
              {cameraReady
                ? hasNativePose
                  ? 'MediaPipe pose live'
                  : 'Camera live'
                : nativeStatus ?? 'Starting iOS camera...'}
            </Text>
          </View>

          <View style={styles.metricsPill}>
            <Text style={styles.metricsText}>Live preview</Text>
          </View>
        </>
      )}

      <TouchableOpacity
        style={styles.flipButton}
        onPress={() => setFacing((current) => (current === 'front' ? 'back' : 'front'))}
      >
        <Feather name="refresh-cw" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraPanel: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111827',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#374151',
  },
  fillPanel: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 0,
    aspectRatio: undefined,
    borderRadius: 0,
    borderWidth: 0,
  },
  statusPill: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: '68%',
    backgroundColor: 'rgba(17, 24, 39, 0.78)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  metricsPill: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.78)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  metricsText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  flipButton: {
    position: 'absolute',
    right: 12,
    top: 52,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  nativePanel: {
    width: '100%',
    minHeight: 220,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  nativeTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8 },
  nativeCopy: { color: colors.text.tertiary, fontSize: 12, textAlign: 'center', marginTop: 8 },
  permissionButton: {
    marginTop: 16,
    borderRadius: 9999,
    backgroundColor: colors.primary.teal,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  permissionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  simulatorNotice: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '34%',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    padding: 18,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
  },
  simulatorTitle: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  simulatorCopy: { color: colors.text.tertiary, fontSize: 12, textAlign: 'center' },
});
