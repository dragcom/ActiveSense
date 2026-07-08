import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Speech from 'expo-speech';
import { addWorkoutResult } from '../services/storage';
import PoseCameraPreview from '../components/PoseCameraPreview';
import { db } from '../services/database';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { WorkoutExercise } from '../types';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { Camera } from 'expo-camera';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutSession'>;
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}
const AVATAR_SOURCE = { uri: 'http://activesense.dpdns.org?mode=live' };

export default function WorkoutSessionScreen({ navigation, route }: Props) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [reps, setReps] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCamera, setShowCamera] = useState(true); 
  const [pointsEarned, setPointsEarned] = useState(0);
  const [posePointCount, setPosePointCount] = useState(0);
  const [dynamicFeedback, setDynamicFeedback] = useState('Position yourself in frame...');
  const [isStaticMode, setIsStaticMode] = useState(false);
  const lastAudioTime = useRef(0);
  const repPhase = useRef<'top' | 'bottom' | 'middle' | 'unknown'>('unknown');
  const currentEx = exercises[currentExercise];
  const targetReps = currentEx ? currentEx.sets * currentEx.reps : 1;
  const progress = useMemo(() => Math.min(100, (reps / targetReps) * 100), [reps, targetReps]);
  const startTimeRef = useRef(Date.now());
  const webViewRef = useRef<WebView>(null);
  const lastFrameTime = useRef(0);
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  const INJECTED_LOG_BRIDGE = `
  (function() {
    function wrapLog(type) {
      var orig = console[type];
      console[type] = function() {
        orig.apply(console, arguments);
        var msg = Array.from(arguments).map(function(v) {
          try { 
            return typeof v === 'object' ? JSON.stringify(v) : String(v); 
          } catch(e) { 
            return String(v); 
          }
        }).join(' ');
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'CONSOLE_' + type.toUpperCase(), 
            data: msg 
          }));
        }
      };
    }
    wrapLog('log');
    wrapLog('warn');
    wrapLog('error');

    setTimeout(function() {
      if (window.ReactNativeWebView) {
        var diagnostics = {
          type: 'WEBVIEW_DIAGNOSTICS',
          isSecureContext: window.isSecureContext,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
          currentOrigin: window.location.origin,
          userAgent: navigator.userAgent
        };
        window.ReactNativeWebView.postMessage(JSON.stringify(diagnostics));
      }
    }, 1500);
  })();
  true;
`;

  // UNIFIED ONMESSAGE HANDLER (Fixes the duplicate error)
  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'WEBVIEW_DIAGNOSTICS') {
        console.log("============== 🛠️ WEBVIEW DIAGNOSTICS 🛠️ ==============");
        console.log(`🔒 Is Secure Context?:          ${data.isSecureContext}`);
        console.log(`📦 Has navigator.mediaDevices?: ${data.hasMediaDevices}`);
        console.log(`📷 Has getUserMedia?:           ${data.hasGetUserMedia}`);
        console.log(`🌐 Current Loaded Origin:       ${data.currentOrigin}`);
        console.log("======================================================");
        return;
      }

      if (data.type === 'WEBVIEW_READY') {
        setIsWebViewReady(true);
        console.log("[STEP 3] RN received WEBVIEW_READY handshake!");
      } else if (data.type === 'LIVE_POSE_ACK') {
        console.log(`[STEP 5] SUCCESS! WebView processed frame. Points checked: ${data.pointsChecked}`);
      } else if (data.type === 'CONSOLE_LOG' || data.type === 'CONSOLE_WARN' || data.type === 'CONSOLE_ERROR') {
        console.log(`[Avatar WebView Log] ${data.data}`);
      }
    } catch (e) {
      console.error("Error parsing message from WebView:", e);
    }
  };

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      
      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "This app needs camera access to track your posture.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    })();
  }, []);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [currentExercise]);

  useEffect(() => {
    let mounted = true;
    const loadExercises = async () => {
      try {
        const workoutExercises = await db.getWorkoutExercises(route.params?.workoutId);
        if (mounted) {
          setExercises(workoutExercises);
          setLoadingExercises(false);
        }
      } catch (error) {
        if (mounted) setLoadingExercises(false);
        Alert.alert('Unable to load workout', 'Please try another session.');
      }
    };
    loadExercises();
    return () => { mounted = false; };
  }, [route.params?.workoutId]);

  const triggerVoice = useCallback((text: string) => {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastAudioTime.current > 3000) {
      Speech.speak(text, { rate: 1.05 });
      lastAudioTime.current = now;
    }
  }, [soundEnabled]);

  const handleLandmarks = useCallback((landmarks: Landmark[]) => {
    if (isPaused || !currentEx || !isWebViewReady || !webViewRef.current) return;
    const packedData = landmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 1
    }));

    const now = Date.now();
    if (now - lastFrameTime.current > 32) {
      lastFrameTime.current = now;
      console.log("⚡ Injecting coordinate frame into Avatar WebView...");
      const payload = JSON.stringify({ type: 'LIVE_POSE', joints: packedData });
      const script = `if (window.receiveRNMessage) { window.receiveRNMessage(${payload}); } true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [isPaused, currentEx, isWebViewReady]);

  const handleManualRep = () => {
    if (isPaused) return;
    setReps(prev => {
      const newReps = prev + 1;
      if (newReps > targetReps) return targetReps;
      if (newReps === targetReps) triggerVoice("Set complete!");
      return newReps;
    });
  };

  const handleNext = async () => {
    if (!currentEx) return;
    const completionRatio = Math.min(1, reps / targetReps);
    const timeElapsed = (Date.now() - startTimeRef.current) / 1000;
    const minExpectedTime = reps * 2; 
    const isRushed = reps > 0 && timeElapsed < minExpectedTime;
    let earnedThisRound = Math.floor(currentEx.points * completionRatio);
    
    if (isRushed) {
      earnedThisRound = Math.floor(earnedThisRound * 0.5);
      Alert.alert("Pacing Warning", "You finished faster than expected! Points reduced.");
    }

    const newTotal = pointsEarned + earnedThisRound;
    setPointsEarned(newTotal);

    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(currentExercise + 1);
      setReps(0);
      repPhase.current = 'unknown';
      startTimeRef.current = Date.now(); 
      return;
    }

    try {
      await addWorkoutResult(newTotal, route.params?.workoutId, posePointCount);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Unable to save workout', 'Please try again.');
    }
  };

  if (loadingExercises || !currentEx) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary.tealLight} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{currentEx.name}</Text>
            <Text style={styles.headerSubtitle}>Exercise {currentExercise + 1} of {exercises.length}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={styles.headerTotalText}>{pointsEarned} HP Total</Text>
        </View>
      </View>

      <View style={styles.content}>
        <LinearGradient colors={colors.gradient.success} style={styles.feedback}>
          <Feather name="activity" size={16} color="#fff" />
          <Text style={styles.feedbackText}>{dynamicFeedback}</Text>
        </LinearGradient>

        <View style={styles.avatarContainer}>
          <View style={[styles.cameraView, !showCamera && { position: 'absolute', top: -10000, left: -10000 }]}>
            <PoseCameraPreview enabled={!isPaused && hasPermission} onLandmarks={handleLandmarks} style={styles.cameraView} />
          </View>

          <View style={[styles.cameraView, showCamera && { position: 'absolute', top: -10000, left: -10000 }]}>
            <WebView
              ref={webViewRef}
              source={AVATAR_SOURCE}
              onMessage={onMessage}
              scrollEnabled={false}
              webviewDebuggingEnabled={true} 
              mediaCapturePermissionGrantType="grant"
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              originWhitelist={['*']}
              injectedJavaScriptBeforeContentLoaded={INJECTED_LOG_BRIDGE}
              containerStyle={{ backgroundColor: 'transparent' }}
              style={[styles.cameraView, { backgroundColor: 'transparent' }]}
            />
          </View>
        </View>

        <View style={styles.controlPanel}>
          <View style={styles.controlHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{currentEx.name}</Text>
              <Text style={styles.exerciseSets}>{currentEx.sets} sets × {currentEx.reps} reps</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.controlButton, soundEnabled && { backgroundColor: colors.primary.teal }]}
                onPress={() => setSoundEnabled(!soundEnabled)}
              >
                <Feather name={soundEnabled ? 'volume-2' : 'volume-x'} size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlButton, showCamera && { backgroundColor: colors.primary.teal }]}
                onPress={() => setShowCamera(!showCamera)}
              >
                <Feather name="camera" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {isStaticMode ? (
            <TouchableOpacity style={styles.staticLogButton} onLongPress={handleManualRep} delayLongPress={500} activeOpacity={0.8}>
              <Feather name="check-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.staticLogTitle}>Reps (Tap if missed) </Text>
                <Text style={styles.staticLogSubtitle}>{reps} of {targetReps} completed</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <LinearGradient colors={colors.gradient.primary} style={styles.repCounter}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 4 }} onPress={handleManualRep} activeOpacity={0.7}>
                <Text style={styles.repLabel}>Reps (Tap if missed)</Text>
                <Text style={styles.repValue}>{reps} / {targetReps}</Text>
              </TouchableOpacity>
              <View style={styles.pointsIndicator}>
                <Text style={{ fontSize: 13, marginRight: 4 }}>🎉</Text>
                <Text style={styles.pointsText}>+{currentEx.points} HP</Text>
              </View>
              <TouchableOpacity onPress={() => setReps(0)} style={[styles.resetButton, {marginLeft: 8}]}>
                <Feather name="refresh-cw" size={18} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          )}

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.pauseButton} onPress={() => setIsPaused(!isPaused)}>
              <Feather name={isPaused ? 'play' : 'pause'} size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <LinearGradient colors={reps >= targetReps ? colors.gradient.primary : ['#4B5563', '#4B5563']} style={{ borderRadius: 9999 }}>
                <TouchableOpacity onPress={handleNext} style={styles.nextButtonAction}>
                  <Feather name={reps >= targetReps ? "skip-forward" : "fast-forward"} size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                    {currentExercise === exercises.length - 1 ? (reps >= targetReps ? 'Finish' : 'End Early') : (reps >= targetReps ? 'Next' : 'Skip')}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.dark },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.background.dark, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#1F2937' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  headerTotalText: { fontSize: 16, fontWeight: '700', color: colors.primary.tealLight },
  content: { flex: 1 },
  feedback: { marginHorizontal: 16, marginTop: 8, marginBottom: 4, padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  pointsIndicator: { backgroundColor: '#FBBF24', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  pointsText: { fontSize: 11, fontWeight: '700', color: colors.text.primary },
  avatarContainer: { flex: 1, backgroundColor: '#000', width: '100%', marginVertical: 4, alignItems: 'stretch', justifyContent: 'center', overflow: 'hidden' },
  cameraView: { flex: 1, width: '100%', height: '100%', alignSelf: 'stretch' },
  controlPanel: { backgroundColor: 'rgba(31, 41, 55, 0.95)', marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: '#374151' },
  controlHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  exerciseName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  exerciseSets: { fontSize: 11, color: colors.text.tertiary, marginTop: 1 },
  controlButton: { width: 32, height: 32, backgroundColor: '#374151', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  repCounter: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center' },
  repLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)' },
  repValue: { fontSize: 22, fontWeight: '700', color: '#fff' }, 
  resetButton: { width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  progressBarTrack: { height: 5, backgroundColor: '#374151', borderRadius: 9999, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: colors.primary.tealLight },
  pauseButton: { flex: 1, backgroundColor: '#374151', paddingVertical: 10, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  staticLogButton: { backgroundColor: colors.primary.teal, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.primary.tealLight },
  staticLogTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  staticLogSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  nextButtonAction: { paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }
});