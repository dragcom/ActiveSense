import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Speech from 'expo-speech';
import { addWorkoutResult } from '../services/storage';
import PoseCameraPreview from '../components/PoseCameraPreview';
import WorkoutAvatarWebView, { WorkoutAvatarWebViewHandle } from '../components/WorkoutAvatarWebView';
import { db } from '../services/database';
import { createPoseClassifier, formatPoseClass } from '../services/poseClassifier';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { PoseClassification, PoseLandmark, WorkoutExercise } from '../types';
import { evaluatePosture } from '../utils/postureRules';
import { calculateExerciseScore } from '../utils/workoutScoring';
import {
  addManualWorkoutRep,
  countWorkoutPoseFrame,
  createWorkoutPoseCounterState,
  resetWorkoutPoseCounter,
} from '../utils/workoutPoseCounter';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutSession'>;

// WorkoutSessionScreen runs the shared camera-first exercise tracker and rep counter.
export default function WorkoutSessionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  // Exercise progress and pose status stay local to this full-screen session.
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [reps, setReps] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [posePointCount, setPosePointCount] = useState(0);
  const [posePrediction, setPosePrediction] = useState<PoseClassification | null>(null);
  const [postureFeedback, setPostureFeedback] = useState<string | null>(null);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [hasAvatarFailed, setHasAvatarFailed] = useState(false);
  const avatarWebViewRef = useRef<WorkoutAvatarWebViewHandle>(null);
  const poseClassifierRef = useRef<ReturnType<typeof createPoseClassifier> | null>(null);
  // Refs hold timing flags so camera frames do not trigger extra renders.
  const poseCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const lastAvatarFrameAtRef = useRef(0);
  const lastPredictionAtRef = useRef(0);
  const lastSpokenAtRef = useRef(0);
  const spokenCueTimesRef = useRef<Record<string, number>>({});
  const poseCounterRef = useRef(createWorkoutPoseCounterState());
  const closingRef = useRef(false);

  const currentEx = exercises[currentExercise];
  const targetReps = currentEx ? currentEx.sets * currentEx.reps : 1;
  const exerciseComplete = reps >= targetReps;
  const hasPoseTracking = posePointCount > 0;
  const progress = useMemo(() => Math.min(100, (reps / targetReps) * 100), [reps, targetReps]);

  const speakWorkoutCue = useCallback((text: string, minIntervalMs = 6000, interrupt = false) => {
    if (!soundEnabled || closingRef.current) {
      return;
    }
    const now = Date.now();
    const cueKey = text.toLowerCase();
    if (!interrupt && now - (spokenCueTimesRef.current[cueKey] ?? 0) < minIntervalMs) {
      return;
    }
    if (!interrupt && now - lastSpokenAtRef.current < 1800) {
      return;
    }
    lastSpokenAtRef.current = now;
    spokenCueTimesRef.current[cueKey] = now;
    if (Platform.OS !== 'web') {
      if (interrupt) {
        Speech.stop();
      }
      Speech.speak(text, { rate: 1, pitch: 1, volume: 1 });
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const speech = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    if (!speech || !Utterance) {
      return;
    }
    if (interrupt) {
      speech.cancel();
    }
    const utterance = new Utterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    speech.speak(utterance);
  }, [soundEnabled]);

  useEffect(() => {
    if (!soundEnabled && Platform.OS === 'web' && typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
    if (!soundEnabled && Platform.OS !== 'web') {
      Speech.stop();
    }
  }, [soundEnabled]);

  useEffect(() => () => {
    closingRef.current = true;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
      return;
    }
    Speech.stop();
  }, []);

  useEffect(() => {
    let mounted = true;
    // Load the selected workout's exercises and train the pose classifier once.
    const loadExercises = async () => {
      try {
        const [workoutExercises, poseTrainingSamples] = await Promise.all([
          db.getWorkoutExercises(route.params?.workoutId),
          db.getPoseTrainingSamples(),
        ]);
        if (mounted) {
          poseClassifierRef.current = createPoseClassifier(poseTrainingSamples);
          setExercises(workoutExercises);
          setLoadingExercises(false);
        }
      } catch (error) {
        if (mounted) {
          setLoadingExercises(false);
        }
        Alert.alert('Unable to load workout', 'Please try another session.');
      }
    };

    loadExercises();

    return () => {
      mounted = false;
    };
  }, [route.params?.workoutId]);

  const sendPoseFrameToAvatar = useCallback((landmarks: PoseLandmark[]) => {
    if (!avatarWebViewRef.current || landmarks.length === 0) {
      return;
    }
    const now = Date.now();
    if (now - lastAvatarFrameAtRef.current < 32) {
      return;
    }
    lastAvatarFrameAtRef.current = now;
    avatarWebViewRef.current.sendPoseFrame(landmarks);
  }, []);

  const handleLandmarks = useCallback((landmarks: PoseLandmark[]) => {
    if (closingRef.current) {
      return;
    }
    // This callback receives 33-point pose frames from the shared WebView camera.
    if (poseCountRef.current !== landmarks.length) {
      poseCountRef.current = landmarks.length;
      setPosePointCount(landmarks.length);
    }
    sendPoseFrameToAvatar(landmarks);
    const now = Date.now();
    if (now - lastPredictionAtRef.current < 300) {
      // Classify only a few times per second to keep the UI responsive.
      return;
    }
    lastPredictionAtRef.current = now;
    const postureLandmarks = landmarks.map((landmark) => ({
      x: landmark.screenX ?? landmark.x,
      y: landmark.screenY ?? landmark.y,
      z: landmark.screenX !== undefined && landmark.screenY !== undefined ? 0 : landmark.z,
      visibility: landmark.visibility,
    }));
    const prediction = poseClassifierRef.current?.(postureLandmarks) ?? null;
    const posture = currentEx ? evaluatePosture(currentEx.poseClass, postureLandmarks) : null;
    const effectivePrediction =
      currentEx && posture && !posture.isStatic && posture.confidence >= 0.55
        ? {
            label: currentEx.poseClass,
            confidence: Math.max(prediction?.label === currentEx.poseClass ? prediction.confidence : 0, posture.confidence),
            distance: prediction?.label === currentEx.poseClass ? prediction.distance : 0,
          }
        : prediction;
    setPosePrediction(effectivePrediction);
    const nextPostureFeedback =
      posture && currentEx && (posture.warning || posture.position === 'middle' || posture.position === 'unknown')
        ? posture.warning ?? posture.feedback
        : null;
    setPostureFeedback(nextPostureFeedback);
    if (nextPostureFeedback) {
      speakWorkoutCue(nextPostureFeedback, 7000);
    }

    if (!currentEx || isPaused || isClosing) {
      return;
    }

    const isExpectedPose =
      effectivePrediction?.label === currentEx.poseClass && effectivePrediction.confidence >= 0.45;
    setReps((current) => {
      const result = countWorkoutPoseFrame(poseCounterRef.current, {
        posture,
        isExpectedPose: posture && !posture.isStatic ? undefined : isExpectedPose,
        currentReps: current,
        targetReps,
        now,
      });
      if (result.counted) {
        speakWorkoutCue(result.nextReps === targetReps ? 'Set complete!' : `${result.nextReps}`, 600, true);
      }
      return result.nextReps;
    });
  }, [currentEx, isClosing, isPaused, sendPoseFrameToAvatar, speakWorkoutCue, targetReps]);

  useEffect(() => {
    // New exercises start ready to count the next valid rep.
    startTimeRef.current = Date.now();
    resetWorkoutPoseCounter(poseCounterRef.current);
    setPostureFeedback(null);
    if (currentEx) {
      speakWorkoutCue(`${currentEx.name}. Target ${targetReps} reps`, 1200, true);
    }
  }, [currentExercise, currentEx, speakWorkoutCue, targetReps]);

  const handleManualRep = () => {
    // Simulator and unsupported native builds can still walk through the workout flow.
    if (isPaused) {
      return;
    }
    resetWorkoutPoseCounter(poseCounterRef.current);
    setReps((current) => {
      const next = addManualWorkoutRep(current, targetReps);
      if (next !== current) {
        speakWorkoutCue(`${next}`, 600, true);
      }
      return next;
    });
  };

  const handleResetReps = () => {
    resetWorkoutPoseCounter(poseCounterRef.current);
    setReps(0);
  };

  const handleTogglePause = () => {
    resetWorkoutPoseCounter(poseCounterRef.current);
    setIsPaused((current) => !current);
  };

  const handleClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    setIsClosing(true);
    setIsPaused(true);
    poseClassifierRef.current = null;
    setPosePrediction(null);
    setPostureFeedback(null);
    setPosePointCount(0);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    } else {
      Speech.stop();
    }

    requestAnimationFrame(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.replace('Main');
    });
  }, [navigation]);

  const handleNext = async () => {
    // Advance between exercises or save the final workout result.
    if (!currentEx || isSavingResult) {
      return;
    }
    const score = calculateExerciseScore({
      basePoints: currentEx.points,
      reps,
      targetReps,
      elapsedMs: Date.now() - startTimeRef.current,
    });
    const earned = pointsEarned + score.points;
    setPointsEarned(earned);
    if (score.isRushed && score.points > 0) {
      Alert.alert('Pacing warning', 'That set was completed faster than expected, so points were reduced.');
    }

    if (currentExercise < exercises.length - 1) {
      speakWorkoutCue('Exercise complete. Next exercise.', 900, true);
      setCurrentExercise(currentExercise + 1);
      setReps(0);
      setPosePrediction(null);
      setPostureFeedback(null);
      resetWorkoutPoseCounter(poseCounterRef.current);
      startTimeRef.current = Date.now();
      return;
    }

    try {
      speakWorkoutCue('Workout complete. Saving your progress.', 900, true);
      setIsSavingResult(true);
      // Quick Start resolves its workout through the exercise list, so persist that ID too.
      await addWorkoutResult(earned, route.params?.workoutId ?? currentEx.workoutId, posePointCount);
      navigation.goBack();
    } catch (error) {
      setIsSavingResult(false);
      Alert.alert('Unable to save workout', 'Please try again.');
    }
  };

  if (loadingExercises) {
    // The camera view waits until exercise metadata and pose samples are ready.
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary.tealLight} />
      </View>
    );
  }

  if (!currentEx) {
    // Empty workouts should explain the setup issue instead of leaving the user on a spinner.
    return (
      <View style={styles.emptyContainer}>
        <Feather name="database" size={28} color={colors.primary.tealLight} />
        <Text style={styles.emptyTitle}>No exercises found</Text>
        <Text style={styles.emptyCopy}>Seed workout_exercises in Supabase, then try this workout again.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>Back to workouts</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const detectedText = posePrediction
    ? `${formatPoseClass(posePrediction.label)} · ${Math.round(posePrediction.confidence * 100)}%`
    : posePointCount > 0
      ? 'Tracking pose'
      : 'Looking for full pose';
  const trackerText = `${posePointCount}/${currentEx.targetLandmarks} points`;
  const handleAvatarReady = useCallback(() => setHasAvatarFailed(false), []);
  const handleAvatarFailure = useCallback(() => setHasAvatarFailed(true), []);

  return (
    <View style={styles.container}>
      {/* The camera preview is the full-screen underlay behind all workout controls. */}
      <View style={styles.cameraUnderlay}>
        {!isClosing && (
          <>
            <View style={[StyleSheet.absoluteFill, (showCameraPreview || hasAvatarFailed) && styles.hiddenPreview]}>
              <WorkoutAvatarWebView
                ref={avatarWebViewRef}
                onReady={handleAvatarReady}
                onFailed={handleAvatarFailure}
                style={styles.avatarWebView}
              />
            </View>
            <View style={[StyleSheet.absoluteFill, !(showCameraPreview || hasAvatarFailed) && styles.hiddenPreview]}>
              <PoseCameraPreview
                enabled={!isPaused}
                onLandmarks={handleLandmarks}
                overlayMode="skeleton"
                presentation="fill"
                style={styles.cameraPreview}
              />
            </View>
          </>
        )}
      </View>

      <LinearGradient
        colors={['rgba(17,24,39,0.92)', 'rgba(17,24,39,0.45)', 'rgba(17,24,39,0)']}
        style={styles.topShade}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(17,24,39,0)', 'rgba(17,24,39,0.72)', 'rgba(17,24,39,0.94)']}
        style={styles.bottomShade}
        pointerEvents="none"
      />

      {/* Top overlay shows the current exercise and live feedback prompt. */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity disabled={isClosing} onPress={handleClose} style={styles.iconButton}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.pointsPill}>
            <Feather name="award" size={15} color={colors.primary.tealLight} />
            <Text style={styles.pointsPillText}>Total {pointsEarned} HP</Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentEx.name}</Text>
          <Text style={styles.headerSubtitle}>Exercise {currentExercise + 1} of {exercises.length}</Text>
        </View>

        <View style={styles.feedbackPill}>
          <Feather name="check-circle" size={18} color="#fff" />
          <Text style={styles.feedbackText} numberOfLines={2}>
            {postureFeedback
              ? postureFeedback
              : posePrediction?.label === currentEx.poseClass
              ? `Recognized ${formatPoseClass(currentEx.poseClass)}. ${currentEx.feedbackPrompt}`
              : currentEx.feedbackPrompt}
          </Text>
        </View>
      </View>

      {/* Bottom panel shows rep progress, controls, and next-step action. */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.repCard}>
          <View style={styles.repHeaderRow}>
            <View style={styles.repTextBlock}>
              <Text style={styles.repValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {reps}/{targetReps}
              </Text>
              <Text style={styles.repSubtext} numberOfLines={1}>
                {`${trackerText} · ${detectedText}`}
              </Text>
            </View>
            <View style={styles.hpPill}>
              <Feather name="award" size={15} color={colors.primary.teal} />
              <Text style={styles.hpPillText}>+{currentEx.points} HP</Text>
            </View>
          </View>
          <View style={styles.repControlsRow}>
            <TouchableOpacity accessibilityLabel="Reset reps" onPress={handleResetReps} style={styles.resetButton}>
              <Feather name="refresh-cw" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Add one manual rep"
              onPress={handleManualRep}
              style={[styles.manualRepButton, hasPoseTracking && styles.manualRepButtonSubtle]}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.soundButton, soundEnabled && styles.soundButtonActive]}
              onPress={() => setSoundEnabled(!soundEnabled)}
            >
              <Feather name={soundEnabled ? 'volume-2' : 'volume-x'} size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Toggle camera preview"
              style={[styles.soundButton, showCameraPreview && styles.soundButtonActive]}
              onPress={() => setShowCameraPreview(!showCameraPreview)}
            >
              <Feather name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.pauseButton} onPress={handleTogglePause}>
            <Feather name={isPaused ? 'play' : 'pause'} size={20} color="#fff" />
            <Text style={styles.actionText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
          <LinearGradient
            colors={exerciseComplete && !isSavingResult ? colors.gradient.primary : ['#4B5563', '#4B5563']}
            style={styles.nextGradient}
          >
            <TouchableOpacity disabled={isSavingResult} onPress={handleNext} style={styles.nextButton}>
              <Feather name={exerciseComplete && !isSavingResult ? 'check-circle' : 'fast-forward'} size={20} color="#fff" />
              <Text style={styles.actionText}>
                {isSavingResult
                  ? 'Saving'
                  : exerciseComplete
                  ? currentExercise === exercises.length - 1
                    ? 'Finish'
                    : 'Next exercise'
                  : currentExercise === exercises.length - 1
                    ? 'End Early'
                    : 'Skip'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.dark, overflow: 'hidden' },
  cameraUnderlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background.dark,
  },
  avatarWebView: { flex: 1, backgroundColor: 'transparent' },
  cameraPreview: { flex: 1, width: '100%', height: '100%' },
  hiddenPreview: { opacity: 0, pointerEvents: 'none' },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 260 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 260 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 18 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    borderWidth: 1,
    borderColor: colors.primary.teal,
  },
  pointsPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  titleBlock: { marginTop: 14 },
  headerTitle: { fontSize: 23, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  feedbackPill: {
    marginTop: 14,
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20, 184, 166, 0.88)',
  },
  feedbackText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  bottomPanel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 0,
    gap: 12,
    paddingHorizontal: 2,
  },
  repCard: {
    minHeight: 124,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: 'rgba(20, 184, 166, 0.86)',
  },
  repHeaderRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  repTextBlock: { flex: 1, minWidth: 0 },
  repValue: { color: '#fff', fontSize: 44, fontWeight: '900', includeFontPadding: false },
  repSubtext: { color: 'rgba(255,255,255,0.84)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  repControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  hpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FBBF24',
  },
  hpPillText: { color: colors.text.primary, fontSize: 12, fontWeight: '900' },
  resetButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  manualRepButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.42)',
  },
  manualRepButtonSubtle: { backgroundColor: 'rgba(17, 24, 39, 0.28)' },
  soundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.38)',
  },
  soundButtonActive: { backgroundColor: 'rgba(17, 24, 39, 0.54)' },
  progressBarTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 9999, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.primary.tealLight },
  actionRow: { flexDirection: 'row', gap: 12 },
  pauseButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 9999,
    backgroundColor: 'rgba(75, 85, 99, 0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextGradient: { flex: 1, borderRadius: 9999 },
  nextButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background.dark,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 28,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  emptyCopy: { color: colors.text.tertiary, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  emptyButton: {
    marginTop: 8,
    borderRadius: 9999,
    backgroundColor: colors.primary.teal,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
