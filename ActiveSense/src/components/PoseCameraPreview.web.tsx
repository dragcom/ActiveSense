import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import AvatarPoseOverlay from './AvatarPoseOverlay';
import { colors } from '../theme/colors';
import { PoseLandmark } from '../types';

// The web camera preview runs MediaPipe Tasks in the browser and draws overlays.
type PoseCameraPreviewProps = {
  enabled: boolean;
  onLandmarks?: (landmarks: PoseLandmark[]) => void;
  overlayMode?: 'avatar' | 'skeleton';
  avatarUrl?: string;
  presentation?: 'card' | 'fill';
  style?: StyleProp<ViewStyle>;
};

// Lightweight performance stats are shown in the corner of the web preview.
type PoseStats = {
  status: string;
  landmarkCount: number;
  fps: number;
  inferenceMs: number;
};

// Local public assets let the browser run MediaPipe without fetching from a CDN.
const MEDIAPIPE_WASM_PATH = '/mediapipe/tasks-vision/wasm';
const MEDIAPIPE_BUNDLE_URL = '/mediapipe/tasks-vision/vision_bundle.mjs';
const POSE_MODEL_PATH = '/mediapipe/models/pose_landmarker_lite.task';

// This connection list matches MediaPipe's 33-landmark human skeleton.
const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
] as const;

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

// Missing visibility is treated as visible because some runtimes omit the value.
const getVisibility = (landmark?: PoseLandmark) => landmark?.visibility ?? 1;

// Normalize unknown errors into readable status text.
const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const getShowPoseDebugOverlay = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('poseDebug') !== '0';

const hasBrowserCamera = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function';

const getBrowserCameraUnavailableStatus = () => {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return 'Webcam unavailable: open with HTTPS or localhost so MediaPipe can use camera frames';
  }
  return 'Webcam unavailable in this browser; use Safari or Chrome with camera permission enabled';
};

const getCameraStartupErrorStatus = (error: unknown) => {
  const message = getErrorMessage(error);
  if (/permission|denied|notallowed/i.test(message)) {
    return 'Camera permission denied; allow webcam access so MediaPipe can capture pose';
  }
  if (/notfound|device|camera/i.test(message)) {
    return 'No webcam found; connect or enable a camera to capture pose';
  }
  return `Camera or MediaPipe failed: ${message.slice(0, 72)}`;
};

// Create the MediaPipe pose detector, trying GPU first and CPU as fallback.
const createPoseLandmarker = async () => {
  const importFromUrl = new Function('url', 'return import(url)');
  const vision = await importFromUrl(MEDIAPIPE_BUNDLE_URL);
  const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
  const options = {
    baseOptions: { modelAssetPath: POSE_MODEL_PATH, delegate: 'GPU' as const },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };

  try {
    return await vision.PoseLandmarker.createFromOptions(fileset, options);
  } catch (gpuError) {
    return vision.PoseLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: POSE_MODEL_PATH, delegate: 'CPU' },
    });
  }
};

// Draw the original skeleton overlay onto a canvas when avatar mode is not selected.
const drawSkeleton = (
  canvas: HTMLCanvasElement,
  landmarks: PoseLandmark[],
  videoWidth: number,
  videoHeight: number,
) => {
  const context = canvas.getContext('2d');
  if (!context || !videoWidth || !videoHeight) {
    return;
  }

  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.round(displayWidth * scale));
  const targetHeight = Math.max(1, Math.round(displayHeight * scale));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, displayWidth, displayHeight);

  if (landmarks.length !== 33) {
    return;
  }

  const videoRatio = videoWidth / videoHeight;
  const panelRatio = displayWidth / displayHeight;
  const drawnWidth = panelRatio > videoRatio ? displayWidth : displayHeight * videoRatio;
  const drawnHeight = panelRatio > videoRatio ? displayWidth / videoRatio : displayHeight;
  const offsetX = (displayWidth - drawnWidth) / 2;
  const offsetY = (displayHeight - drawnHeight) / 2;

  const pointFor = (landmark: PoseLandmark) => ({
    // The webcam preview is mirrored, so x is flipped to match what the user sees.
    x: offsetX + (1 - clampUnit(landmark.x)) * drawnWidth,
    y: offsetY + clampUnit(landmark.y) * drawnHeight,
  });

  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = 'rgba(15, 23, 42, 0.45)';
  context.shadowBlur = 8;
  context.lineWidth = 4;
  context.strokeStyle = 'rgba(45, 212, 191, 0.92)';

  POSE_CONNECTIONS.forEach(([from, to]) => {
    if (getVisibility(landmarks[from]) < 0.35 || getVisibility(landmarks[to]) < 0.35) {
      return;
    }
    const start = pointFor(landmarks[from]);
    const end = pointFor(landmarks[to]);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });

  context.shadowBlur = 0;
  landmarks.forEach((landmark, index) => {
    if (getVisibility(landmark) < 0.25) {
      return;
    }
    const point = pointFor(landmark);
    const radius = index <= 10 ? 3.5 : 4.5;
    context.beginPath();
    context.fillStyle = '#FFFFFF';
    context.arc(point.x, point.y, radius + 2, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.fillStyle = '#14B8A6';
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
  });
};

export default function PoseCameraPreview({
  enabled,
  onLandmarks,
  overlayMode = 'avatar',
  avatarUrl,
  presentation = 'card',
  style,
}: PoseCameraPreviewProps) {
  // Browser-only refs hold DOM elements and the MediaPipe detector instance.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const lastStatsAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const [landmarks, setLandmarks] = useState<PoseLandmark[]>([]);
  const [hasCameraStream, setHasCameraStream] = useState(false);
  const showPoseDebugOverlay = overlayMode === 'avatar' && getShowPoseDebugOverlay();
  const [stats, setStats] = useState<PoseStats>({
    status: 'Camera paused',
    landmarkCount: 0,
    fps: 0,
    inferenceMs: 0,
  });

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setStats({
        status: 'Native preview needs expo-camera plus a native pose runtime.',
        landmarkCount: 0,
        fps: 0,
        inferenceMs: 0,
      });
      return undefined;
    }

    let disposed = false;

    const stopCamera = () => {
      // Stop animation and media tracks so the webcam is released cleanly.
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setHasCameraStream(false);
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    const startCamera = async () => {
      if (!enabled) {
        stopCamera();
        setLandmarks([]);
        onLandmarks?.([]);
        setStats({ status: 'Camera paused', landmarkCount: 0, fps: 0, inferenceMs: 0 });
        return;
      }

      if (!hasBrowserCamera()) {
        setLandmarks([]);
        onLandmarks?.([]);
        setStats({
          status: getBrowserCameraUnavailableStatus(),
          landmarkCount: 0,
          fps: 0,
          inferenceMs: 0,
        });
        return;
      }

      try {
        // Request the user's webcam, then attach it to the hidden video element.
        setStats({ status: 'Requesting webcam permission...', landmarkCount: 0, fps: 0, inferenceMs: 0 });
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (disposed || !videoRef.current) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        await videoRef.current.play();
        setHasCameraStream(true);

        setStats({ status: 'Loading MediaPipe pose model...', landmarkCount: 0, fps: 0, inferenceMs: 0 });
        detectorRef.current = await createPoseLandmarker();

        const detectFrame = () => {
          // Each animation frame sends the latest video image through MediaPipe.
          if (disposed || !videoRef.current || !canvasRef.current || !detectorRef.current) {
            return;
          }

          const video = videoRef.current;
          const now = performance.now();
          const inferenceStart = performance.now();
          let result;
          try {
            result = detectorRef.current.detectForVideo(video, now);
          } catch (frameError) {
            setStats({
              status: `MediaPipe frame error: ${getErrorMessage(frameError).slice(0, 72)}`,
              landmarkCount: 0,
              fps: 0,
              inferenceMs: 0,
            });
            return;
          }
          const inferenceMs = performance.now() - inferenceStart;
          const poseLandmarks = (result.landmarks?.[0] ?? []).slice(0, 33) as PoseLandmark[];
          const worldLandmarks = (result.worldLandmarks?.[0] ?? []).slice(0, 33) as PoseLandmark[];
          const avatarLandmarks = poseLandmarks.map((screenLandmark, index) => {
            const worldLandmark = worldLandmarks[index];
            return {
              x: worldLandmark?.x ?? screenLandmark.x,
              y: worldLandmark?.y ?? screenLandmark.y,
              z: worldLandmark?.z ?? screenLandmark.z ?? 0,
              visibility: worldLandmark?.visibility ?? screenLandmark.visibility,
              screenX: screenLandmark.x,
              screenY: screenLandmark.y,
            };
          });

          // Debug avatar mode draws the 33-point skeleton over the GLB for alignment checks.
          if (overlayMode === 'skeleton' || showPoseDebugOverlay) {
            drawSkeleton(canvasRef.current, poseLandmarks, video.videoWidth, video.videoHeight);
          } else {
            const context = canvasRef.current.getContext('2d');
            context?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          setLandmarks(poseLandmarks);
          onLandmarks?.(avatarLandmarks);

          if (now - lastStatsAtRef.current > 250) {
            // Throttle UI stats so React is not updated every camera frame.
            const frameDelta = lastFrameAtRef.current ? now - lastFrameAtRef.current : 0;
            lastStatsAtRef.current = now;
            lastFrameAtRef.current = now;
            setStats({
              status: poseLandmarks.length === 33
                ? 'MediaPipe running: 33 landmarks + skeleton'
                : 'MediaPipe running: looking for full body pose',
              landmarkCount: poseLandmarks.length,
              fps: frameDelta ? Math.round(1000 / frameDelta) : 0,
              inferenceMs: Math.round(inferenceMs),
            });
          }

          frameRef.current = requestAnimationFrame(detectFrame);
        };

        detectFrame();
      } catch (error) {
        setStats({
          status: getCameraStartupErrorStatus(error),
          landmarkCount: 0,
          fps: 0,
          inferenceMs: 0,
        });
        setHasCameraStream(false);
      }
    };

    startCamera();

    return () => {
      disposed = true;
      stopCamera();
      detectorRef.current?.close?.();
      detectorRef.current = null;
    };
  }, [enabled, onLandmarks, overlayMode, showPoseDebugOverlay]);

  if (Platform.OS !== 'web') {
    // Native uses PoseCameraPreview.tsx; this branch only protects accidental web-file imports.
    return (
      <View style={styles.nativePanel}>
        <Text style={styles.nativeTitle}>Camera Preview</Text>
        <Text style={styles.nativeCopy}>
          Web uses MediaPipe Tasks and the GLB avatar overlay now. Expo native needs expo-camera and a native pose
          runtime; iOS Simulator cannot provide a real webcam feed.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.webPanel, presentation === 'fill' && styles.fillPanel, style]}>
      {React.createElement('video' as any, {
        ref: videoRef,
        muted: true,
        autoPlay: true,
        playsInline: true,
        onCanPlay: () => setHasCameraStream(true),
        onPlaying: () => setHasCameraStream(true),
        onPause: () => setHasCameraStream(false),
        onError: () => setHasCameraStream(false),
        style: {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          backgroundColor: '#020617',
        },
      })}
      {!hasCameraStream && (
        <View style={styles.cameraFallback}>
          <Text style={styles.cameraFallbackTitle}>Camera feed not visible</Text>
          <Text style={styles.cameraFallbackCopy}>{stats.status}</Text>
        </View>
      )}
      {/* Avatar overlay owns GLB rendering and falls back to skeleton if needed. */}
      {overlayMode === 'avatar' && <AvatarPoseOverlay landmarks={landmarks} avatarUrl={avatarUrl} />}
      {React.createElement('canvas' as any, {
        ref: canvasRef,
        style: {
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        },
      })}
      <View style={styles.statusPill}>
        <Text style={styles.statusText}>
          {overlayMode === 'avatar' && stats.landmarkCount === 33
            ? 'MediaPipe running: avatar + 33-point overlay'
            : stats.status}
        </Text>
      </View>
      <View style={styles.countPill}>
        <Text style={styles.countText}>{stats.landmarkCount}/33 points</Text>
      </View>
      <View style={styles.metricsPill}>
        <Text style={styles.metricsText}>{stats.fps} FPS · {stats.inferenceMs} ms</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webPanel: {
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
  cameraFallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#020617',
  },
  cameraFallbackTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  cameraFallbackCopy: {
    color: colors.text.tertiary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 420,
    textAlign: 'center',
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
  countPill: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(20, 184, 166, 0.92)',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
  nativeTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  nativeCopy: { color: colors.text.tertiary, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
