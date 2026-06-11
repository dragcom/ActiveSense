import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addWorkoutResult } from '../services/storage';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const exercises = [
  { name: 'Squats', sets: 3, reps: 10, points: 50 },
  { name: 'Wall Push-ups', sets: 3, reps: 8, points: 40 },
  { name: 'Arm Circles', sets: 2, reps: 15, points: 30 },
  { name: 'Leg Raises', sets: 3, reps: 10, points: 50 },
  { name: 'Cool Down Stretch', sets: 1, reps: 1, points: 30 },
];

export default function WorkoutSessionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [currentExercise, setCurrentExercise] = useState(0);
  const [reps, setReps] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  const currentEx = exercises[currentExercise];
  const targetReps = currentEx.sets * currentEx.reps;
  const progress = useMemo(() => Math.min(100, (reps / targetReps) * 100), [reps, targetReps]);

  useEffect(() => {
    if (!isPaused && reps < targetReps) {
      const timer = setTimeout(() => setReps(reps + 1), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [reps, isPaused, targetReps]);

  const handleNext = async () => {
    const earned = pointsEarned + currentEx.points;
    setPointsEarned(earned);

    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(currentExercise + 1);
      setReps(0);
      return;
    }

    try {
      await addWorkoutResult(earned);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Unable to save workout', 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{currentEx.name}</Text>
            <Text style={styles.headerSubtitle}>
              Exercise {currentExercise + 1} of {exercises.length}
            </Text>
          </View>
        </View>
        <LinearGradient colors={colors.gradient.success} style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>Active</Text>
        </LinearGradient>
      </View>

      <View style={styles.content}>
        <LinearGradient colors={colors.gradient.success} style={styles.feedback}>
          <Feather name="check-circle" size={20} color="#fff" />
          <Text style={styles.feedbackText}>Great form! Keep it up!</Text>
        </LinearGradient>

        <View style={styles.pointsIndicator}>
          <Text style={{ fontSize: 20, marginRight: 8 }}>🎉</Text>
          <Text style={styles.pointsText}>+{currentEx.points} HP</Text>
        </View>

        <View style={styles.avatarContainer}>
          <LinearGradient colors={colors.gradient.primary} style={styles.avatar}>
            <Text style={{ fontSize: 80, marginBottom: 16 }}>🧍</Text>
            <Text style={styles.avatarTitle}>Privacy Avatar Mode</Text>
            <Text style={styles.avatarSubtitle}>Your movements are tracked locally</Text>

            <View style={[styles.poseDot, { top: 40, left: 40 }]} />
            <View style={[styles.poseDot, { top: 40, right: 40 }]} />
            <View style={[styles.poseDot, { bottom: 120, left: 60 }]} />
            <View style={[styles.poseDot, { bottom: 120, right: 60 }]} />
          </LinearGradient>
        </View>

        <View style={styles.controlPanel}>
          <View style={styles.controlHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{currentEx.name}</Text>
              <Text style={styles.exerciseSets}>
                {currentEx.sets} sets × {currentEx.reps} reps
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.controlButton, soundEnabled && { backgroundColor: colors.primary.teal }]}
                onPress={() => setSoundEnabled(!soundEnabled)}
              >
                <Feather name={soundEnabled ? 'volume-2' : 'volume-x'} size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlButton, showCamera && { backgroundColor: colors.primary.teal }]}
                onPress={() => setShowCamera(!showCamera)}
              >
                <Feather name="camera" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <LinearGradient colors={colors.gradient.primary} style={styles.repCounter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.repLabel}>Reps Completed</Text>
              <Text style={styles.repValue}>
                {reps} / {targetReps}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReps(0)} style={styles.resetButton}>
              <Feather name="refresh-cw" size={24} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.pauseButton} onPress={() => setIsPaused(!isPaused)}>
              <Feather name={isPaused ? 'play' : 'pause'} size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <LinearGradient
                colors={reps >= targetReps ? colors.gradient.primary : ['#6B7280', '#6B7280']}
                style={{ borderRadius: 9999 }}
              >
                <TouchableOpacity
                  disabled={reps < targetReps}
                  onPress={handleNext}
                  style={{
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Feather name="skip-forward" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                    {currentExercise === exercises.length - 1 ? 'Finish' : 'Next'}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.totalPoints}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>
          Total: {pointsEarned} HP
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.dark },
  header: {
    backgroundColor: colors.background.dark,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  activeDot: { width: 8, height: 8, backgroundColor: '#fff', borderRadius: 4 },
  activeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  content: { flex: 1 },
  feedback: { margin: 24, padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  feedbackText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  pointsIndicator: {
    position: 'absolute',
    top: 100,
    right: 24,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  pointsText: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  avatarContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  avatar: {
    width: 240,
    height: 360,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  avatarSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  poseDot: { position: 'absolute', width: 12, height: 12, backgroundColor: colors.primary.tealLight, borderRadius: 6 },
  controlPanel: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    margin: 24,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  controlHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  exerciseName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  exerciseSets: { fontSize: 12, color: colors.text.tertiary, marginTop: 4 },
  controlButton: {
    width: 40,
    height: 40,
    backgroundColor: '#374151',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repCounter: { borderRadius: 16, padding: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  repLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  repValue: { fontSize: 48, fontWeight: '700', color: '#fff', marginTop: 4 },
  resetButton: { width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  progressBarTrack: { height: 12, backgroundColor: '#374151', borderRadius: 9999, overflow: 'hidden', marginBottom: 16 },
  progressBarFill: { height: '100%', backgroundColor: colors.primary.tealLight },
  pauseButton: {
    flex: 1,
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  totalPoints: {
    position: 'absolute',
    top: 72,
    right: 24,
    backgroundColor: 'rgba(31, 41, 55, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.primary.teal,
  },
});
