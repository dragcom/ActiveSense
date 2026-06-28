import { useRef } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { Landmark } from '../screens/WorkoutSessionScreen';

interface PoseCameraPreviewProps {
  enabled: boolean;
  onLandmarks: (landmarks: Landmark[]) => void;
  style?: StyleProp<ViewStyle>;
}

export default function PoseCameraPreview({ enabled, onLandmarks, style }: PoseCameraPreviewProps) {
  const webViewRef = useRef<WebView>(null);

  if (!enabled) return null;

  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'LANDMARKS') {
        onLandmarks(message.data);
      } else if (message.error) {
        console.error('WASM Camera Error:', message.error);
      }
    } catch (e) {
    }
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body, html { margin: 0; padding: 0; overflow: hidden; height: 100%; background-color: #111827; position: relative; }
        video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999; display: block; }
        #status { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: #fff; padding: 4px 8px; font-family: sans-serif; font-size: 10px; border-radius: 4px; z-index: 1000; }
      </style>
      <script type="module">
        import {PoseLandmarker, FilesetResolver} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

        const statusEl = document.getElementById('status');
        function setStatus(msg) { statusEl.innerText = msg; }

        const POSE_CONNECTIONS = [
          [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
          [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
          [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
          [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
          [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
        ];

        const clampUnit = (value) => Math.max(0, Math.min(1, value));
        const getVisibility = (landmark) => landmark?.visibility ?? 1;

        function drawSkeleton(canvas, landmarks, videoWidth, videoHeight) {
          const context = canvas.getContext('2d');
          if (!context || !videoWidth || !videoHeight) return;

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

          if (!landmarks || landmarks.length !== 33) return;

          const videoRatio = videoWidth / videoHeight;
          const panelRatio = displayWidth / displayHeight;
          const drawnWidth = panelRatio > videoRatio ? displayWidth : displayHeight * videoRatio;
          const drawnHeight = panelRatio > videoRatio ? displayWidth / videoRatio : displayHeight;
          const offsetX = (displayWidth - drawnWidth) / 2;
          const offsetY = (displayHeight - drawnHeight) / 2;

          const pointFor = (landmark) => ({
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
            if (getVisibility(landmarks[from]) < 0.35 || getVisibility(landmarks[to]) < 0.35) return;
            const start = pointFor(landmarks[from]);
            const end = pointFor(landmarks[to]);
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            context.stroke();
          });

          landmarks.forEach((landmark, index) => {
            if (getVisibility(landmark) < 0.25) return;
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
        }

        async function initMediaPipe() {
          try {
            setStatus("Loading model...");
            const vision = await FilesetResolver.forVisionTasks(
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
            );

            const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
                delegate: "CPU" 
              },
              runningMode: "VIDEO",
            });

            setStatus("Starting camera...");
            const video = document.getElementById('webcam');
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: "user" } 
            });
            video.srcObject = stream;
            
            video.onloadedmetadata = () => {
              const canvas = document.getElementById('overlay');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              
              setStatus("Tracking...");
              predictWebcam(poseLandmarker, video);
            };
          } catch (err) {
            setStatus("Init Error: " + err.message);
          }
        }

        async function predictWebcam(poseLandmarker, video) {
          const canvas = document.getElementById('overlay');
          let frameCounter = 0;
          
          async function step() {
            if (video.readyState >= 2) {
              try {
                const results = poseLandmarker.detectForVideo(video, performance.now());
                if (results.landmarks && results.landmarks.length > 0) {
                  const landmarks = results.landmarks[0];
                  
                  setStatus("Points: " + landmarks.length);
                  drawSkeleton(canvas, landmarks, video.videoWidth, video.videoHeight);
                  
                  frameCounter++;
                  if (frameCounter % 40 === 0) {
                    console.log("[STEP 1] MediaPipe WASM client generated tracking coordinates payload bundle successfully.");
                  }

                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'LANDMARKS',
                    data: landmarks 
                  }));
                } else {
                  setStatus("Searching...");
                  const ctx = canvas.getContext('2d');
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
              } catch (e) {
                setStatus("Process Error: " + e.message);
              }
            }
            window.requestAnimationFrame(step);
          }
          step();
        }
        initMediaPipe();
      </script>
    </head>
    <body>
      <div id="status">Initializing AI...</div>
      <video id="webcam" autoplay playsinline muted></video>
      <canvas id="overlay"></canvas>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://localhost' }}  
        onMessage={handleMessage}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        androidLayerType="hardware"
        {...({
          onPermissionRequest: (request: any) => {
            const hasCamera = request.resources.includes('android.webkit.resource.VIDEO_CAPTURE');
            if (hasCamera) {
              request.grant(request.resources);
            }
          }
        } as any)}
        style={styles.webview}
        containerStyle={{ borderRadius: 24, overflow: 'hidden' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#111827' },
  webview: { flex: 1, backgroundColor: 'transparent' },
});