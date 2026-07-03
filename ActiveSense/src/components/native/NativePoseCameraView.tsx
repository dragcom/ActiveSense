import React from 'react';
import { Platform, ViewProps } from 'react-native';
import { requireNativeView } from 'expo';
import { PoseLandmark } from '../../types';

// NativeLandmarksEvent is the JS shape emitted by the Swift/Kotlin pose camera view.
type NativeLandmarksEvent = {
  nativeEvent: {
    landmarks?: PoseLandmark[];
    timestamp?: number;
  };
};

// NativeStatusEvent carries small lifecycle messages from the native camera module.
type NativeStatusEvent = {
  nativeEvent: {
    status?: string;
  };
};

// Props mirror the native view's registered props and events.
export type NativePoseCameraViewProps = ViewProps & {
  enabled?: boolean;
  cameraFacing?: 'front' | 'back';
  onLandmarks?: (event: NativeLandmarksEvent) => void;
  onStatus?: (event: NativeStatusEvent) => void;
};

let NativePoseCamera: React.ComponentType<NativePoseCameraViewProps> | null = null;
let didTryResolveNativePoseCamera = false;

// Android keeps the previous Expo view-config guard; iOS resolves directly because
// the global adapter can be absent even when the local Expo module is linked.
const hasNativePoseViewConfig = () => {
  const expoGlobal = (globalThis as unknown as {
    expo?: { getViewConfig?: (moduleName: string, viewName?: string) => unknown };
  }).expo;
  return Boolean(expoGlobal?.getViewConfig?.('ActiveSensePose'));
};

// Resolve the native view lazily so imports do not warn before the camera screen opens.
const resolveNativePoseCamera = () => {
  if (didTryResolveNativePoseCamera || !(Platform.OS === 'ios' || Platform.OS === 'android')) {
    return NativePoseCamera;
  }
  didTryResolveNativePoseCamera = true;
  if (Platform.OS === 'android' && !hasNativePoseViewConfig()) {
    NativePoseCamera = null;
    return NativePoseCamera;
  }
  try {
    NativePoseCamera = requireNativeView<NativePoseCameraViewProps>('ActiveSensePose');
  } catch {
    NativePoseCamera = null;
  }
  return NativePoseCamera;
};

// The preview uses this check to fall back to Expo Camera when the module is missing.
export function isNativePoseCameraAvailable() {
  return resolveNativePoseCamera() !== null;
}

// This wrapper keeps the rest of the app from importing native code directly.
export default function NativePoseCameraView(props: NativePoseCameraViewProps) {
  const NativePoseCameraViewComponent = resolveNativePoseCamera();
  if (!NativePoseCameraViewComponent) {
    return null;
  }

  return <NativePoseCameraViewComponent {...props} />;
}
