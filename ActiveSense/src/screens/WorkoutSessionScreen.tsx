import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Speech from 'expo-speech';
import { addWorkoutResult, getUserProfile } from '../services/storage';
import { getAvatarRenderUri } from '../services/avatarAssetStorage';
import PoseCameraPreview from '../components/PoseCameraPreview';
import { db } from '../services/database';
import { assessSquatTechnique, assessStandingPose, createPoseClassifier, formatPoseClass } from '../services/poseClassifier';
import { defaultAvatarConfig, normalizeAvatarConfig } from '../data/avatars';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { AvatarProfileConfig, PoseClassification, PoseLandmark, WorkoutExercise } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkoutSession'>;

// WorkoutSessionScreen runs the camera-first exercise tracker and rep counter.
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
  const [squatFeedback, setSquatFeedback] = useState<string | null>(null);
  const [isSavingResult, setIsSavingResult] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [sessionAvatar, setSessionAvatar] = useState<AvatarProfileConfig>(defaultAvatarConfig);
  const poseClassifierRef = useRef<ReturnType<typeof createPoseClassifier> | null>(null);
  // Refs hold timing flags so camera frames do not trigger extra renders.
  const poseCountRef = useRef(0);
  const lastPredictionAtRef = useRef(0);
  const repArmedRef = useRef(true);
  const lastRepAtRef = useRef(0);
  const lastSpokenAtRef = useRef(0);
  const spokenCueTimesRef = useRef<Record<string, number>>({});
  const squatPhaseRef = useRef<'ready' | 'down'>('ready');
  const closingRef = useRef(false);

  const currentEx = exercises[currentExercise];
  const targetReps = currentEx ? currentEx.sets * currentEx.reps : 1;
  const exerciseComplete = reps >= targetReps;
  const hasPoseTracking = posePointCount > 0;
  const progress = useMemo(() => Math.min(100, (reps / targetReps) * 100), [reps, targetReps]);

  useEffect(() => {
    let mounted = true;
    // Start sessions with the avatar chosen during onboarding/profile edit.
    const loadProfileAvatar = async () => {
      try {
        const profile = await getUserProfile();
        const savedAvatar = normalizeAvatarConfig(profile?.avatar);
        if (mounted) {
          setSessionAvatar(savedAvatar);
        }
      } catch (error) {
        // Avatar choice is cosmetic, so workout tracking should continue if profile lookup fails.
      }
    };
    loadProfileAvatar();
    return () => {
      mounted = false;
    };
  }, []);

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

  const handleLandmarks = useCallback((landmarks: PoseLandmark[]) => {
    if (closingRef.current) {
      return;
    }
    // This callback receives 33-point pose frames from web or native camera preview.
    if (poseCountRef.current !== landmarks.length) {
      poseCountRef.current = landmarks.length;
      setPosePointCount(landmarks.length);
    }
    const now = Date.now();
    if (now - lastPredictionAtRef.current < 300) {
      // Classify only a few times per second to keep the UI responsive.
      return;
    }
    lastPredictionAtRef.current = now;
    const prediction = poseClassifierRef.current?.(landmarks) ?? null;
    const squatAssessment = currentEx?.poseClass === 'squat'
      ? assessSquatTechnique(landmarks)
      : null;
    const standingAssessment = currentEx?.poseClass === 'squat'
      ? assessStandingPose(landmarks)
      : null;
    const effectivePrediction =
      squatAssessment?.isProper
        ? {
            label: 'squat' as const,
            confidence: Math.max(prediction?.label === 'squat' ? prediction.confidence : 0, squatAssessment.confidence),
            distance: prediction?.label === 'squat' ? prediction.distance : 0,
          }
        : prediction;
    setPosePrediction(effectivePrediction);
    const nextSquatFeedback =
      currentEx?.poseClass === 'squat' && squatAssessment && !squatAssessment.isProper
        ? squatAssessment.reasons[0] ?? 'Set hips back and keep knees aligned'
        : null;
    setSquatFeedback(nextSquatFeedback);
    if (nextSquatFeedback) {
      speakWorkoutCue(nextSquatFeedback, 7000);
    }

    if (!currentEx || isPaused || isClosing) {
      return;
    }

    if (currentEx.poseClass === 'squat') {
      if (squatAssessment?.isProper) {
        squatPhaseRef.current = 'down';
        return;
      }

      if (
        squatPhaseRef.current === 'down' &&
        standingAssessment?.isStanding &&
        now - lastRepAtRef.current >= 900
      ) {
        squatPhaseRef.current = 'ready';
        lastRepAtRef.current = now;
        setReps((current) => {
          const next = Math.min(targetReps, current + 1);
          if (next !== current) {
            speakWorkoutCue(`${next}`, 600, true);
          }
          return next;
        });
      }
      return;
    }

    if (!effectivePrediction) {
      return;
    }

    const isExpectedPose =
      effectivePrediction.label === currentEx.poseClass && effectivePrediction.confidence >= 0.45;
    if (!isExpectedPose) {
      // Re-arm counting when the user leaves the expected pose.
      repArmedRef.current = true;
      return;
    }

    if (!repArmedRef.current || now - lastRepAtRef.current < 900) {
      // Debounce reps so one held pose is not counted repeatedly.
      return;
    }

    repArmedRef.current = false;
    lastRepAtRef.current = now;
    setReps((current) => {
      const next = Math.min(targetReps, current + 1);
      if (next !== current) {
        speakWorkoutCue(`${next}`, 600, true);
      }
      return next;
    });
  }, [currentEx, isClosing, isPaused, speakWorkoutCue, targetReps]);

  useEffect(() => {
    // New exercises start ready to count the next valid rep.
    repArmedRef.current = true;
    lastRepAtRef.current = 0;
    squatPhaseRef.current = 'ready';
    setSquatFeedback(null);
    if (currentEx) {
      speakWorkoutCue(`${currentEx.name}. Target ${targetReps} reps`, 1200, true);
    }
  }, [currentExercise, currentEx, speakWorkoutCue, targetReps]);

  const handleManualRep = () => {
    // Simulator and unsupported native builds can still walk through the workout flow.
    setReps((current) => {
      const next = Math.min(targetReps, current + 1);
      if (next !== current) {
        speakWorkoutCue(`${next}`, 600, true);
      }
      return next;
    });
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
    setSquatFeedback(null);
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
    const earned = pointsEarned + currentEx.points;
    setPointsEarned(earned);

    if (currentExercise < exercises.length - 1) {
      speakWorkoutCue('Exercise complete. Next exercise.', 900, true);
      setCurrentExercise(currentExercise + 1);
      setReps(0);
      setPosePrediction(null);
      setSquatFeedback(null);
      repArmedRef.current = true;
      squatPhaseRef.current = 'ready';
      return;
    }

    try {
      speakWorkoutCue('Workout complete. Saving your progress.', 900, true);
      setIsSavingResult(true);
      await addWorkoutResult(earned, route.params?.workoutId, posePointCount);
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

  return (
    <View style={styles.container}>
      {/* The camera preview is the full-screen underlay behind all workout controls. */}
      <View style={styles.cameraUnderlay}>
        {!isClosing && (
          <PoseCameraPreview
            enabled={!isPaused}
            onLandmarks={handleLandmarks}
            overlayMode="avatar"
            avatarUrl={getAvatarRenderUri(sessionAvatar)}
            presentation="fill"
          />
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
            {squatFeedback
              ? squatFeedback
              : posePrediction?.label === currentEx.poseClass
              ? `Recognized ${formatPoseClass(currentEx.poseClass)}. ${currentEx.feedbackPrompt}`
              : currentEx.feedbackPrompt}
          </Text>
        </View>
      </View>

      {/* Bottom panel shows rep progress, controls, and next-step action. */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.repCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.repValue}>{reps}/{targetReps}</Text>
            <Text style={styles.repSubtext} numberOfLines={1}>
              {`${trackerText} · ${detectedText}`}
            </Text>
          </View>
          <View style={styles.hpPill}>
            <Feather name="award" size={15} color={colors.primary.teal} />
            <Text style={styles.hpPillText}>+{currentEx.points} HP</Text>
          </View>
          <TouchableOpacity onPress={() => setReps(0)} style={styles.resetButton}>
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
        </View>

        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.pauseButton} onPress={() => setIsPaused(!isPaused)}>
            <Feather name={isPaused ? 'play' : 'pause'} size={20} color="#fff" />
            <Text style={styles.actionText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
          <LinearGradient
            colors={exerciseComplete && !isSavingResult ? colors.gradient.primary : ['#4B5563', '#4B5563']}
            style={styles.nextGradient}
          >
            <TouchableOpacity disabled={!exerciseComplete || isSavingResult} onPress={handleNext} style={styles.nextButton}>
              <Feather name={exerciseComplete && !isSavingResult ? 'check-circle' : 'lock'} size={20} color="#fff" />
              <Text style={styles.actionText}>
                {isSavingResult
                  ? 'Saving'
                  : exerciseComplete
                  ? currentExercise === exercises.length - 1
                    ? 'Finish'
                    : 'Next exercise'
                  : 'Complete reps'}
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
    minHeight: 88,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20, 184, 166, 0.86)',
  },
  repValue: { color: '#fff', fontSize: 46, fontWeight: '900' },
  repSubtext: { color: 'rgba(255,255,255,0.84)', fontSize: 11, fontWeight: '700', marginTop: 2 },
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
