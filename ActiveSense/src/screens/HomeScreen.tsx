import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { CompositeNavigationProp, useIsFocused, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { workouts } from '../data/workouts';
import { defaultStats, getStats, getUserProfile } from '../services/storage';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { UserProfile, UserStats } from '../types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const weeklyData = [
  { id: 'mon', day: 'Mon', points: 120 },
  { id: 'tue', day: 'Tue', points: 150 },
  { id: 'wed', day: 'Wed', points: 100 },
  { id: 'thu', day: 'Thu', points: 180 },
  { id: 'fri', day: 'Fri', points: 140 },
  { id: 'sat', day: 'Sat', points: 200 },
  { id: 'sun', day: 'Sun', points: 160 },
];

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [loading, setLoading] = useState(true);

  const highlightWorkout = useMemo(() => workouts[0], []);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [storedProfile, storedStats] = await Promise.all([getUserProfile(), getStats()]);
        if (mounted) {
          setProfile(storedProfile);
          setStats(storedStats);
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setLoading(false);
        }
        Alert.alert('Unable to load data', 'Please restart the app to try again.');
      }
    };

    if (isFocused) {
      setLoading(true);
      loadData();
    }

    return () => {
      mounted = false;
    };
  }, [isFocused]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary.teal} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={colors.gradient.primary} style={styles.header}>
          <Text style={styles.greeting}>Hi {profile?.name ?? 'there'} 👋</Text>
          <Text style={styles.subGreeting}>Keep your streak alive with a quick session today.</Text>
          <View style={styles.streakCard}>
            <View>
              <Text style={styles.streakLabel}>Current streak</Text>
              <Text style={styles.streakValue}>{stats.streakDays} days</Text>
            </View>
            <View style={styles.streakBadge}>
              <Feather name="zap" size={20} color="#fff" />
              <Text style={styles.streakBadgeText}>On fire</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Healthpoints</Text>
            <Text style={styles.statValue}>{stats.healthpoints.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Workouts</Text>
            <Text style={styles.statValue}>{stats.totalWorkouts}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Goal</Text>
            <Text style={styles.statValue}>30 min</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recommended for you</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Workouts')}>
            <Text style={styles.linkText}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recommendCard}>
          <LinearGradient colors={highlightWorkout.gradient} style={styles.recommendHeader}>
            <Text style={styles.recommendEmoji}>{highlightWorkout.emoji}</Text>
            <View style={styles.recommendBadge}>
              <Text style={styles.recommendBadgeText}>{highlightWorkout.category}</Text>
            </View>
          </LinearGradient>
          <View style={styles.recommendBody}>
            <Text style={styles.recommendTitle}>{highlightWorkout.title}</Text>
            <Text style={styles.recommendDesc}>{highlightWorkout.description}</Text>
            <View style={styles.recommendMeta}>
              <Text style={styles.metaText}>{highlightWorkout.duration}</Text>
              <Text style={styles.metaDivider}>•</Text>
              <Text style={styles.metaText}>{highlightWorkout.calories}</Text>
              <Text style={styles.metaDivider}>•</Text>
              <Text style={styles.metaText}>{highlightWorkout.difficulty}</Text>
            </View>
            <LinearGradient colors={colors.gradient.primary} style={styles.primaryButton}>
              <TouchableOpacity
                style={styles.primaryButtonInner}
                onPress={() => navigation.navigate('WorkoutSession', { workoutId: highlightWorkout.id })}
              >
                <Feather name="play" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Start workout</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('WorkoutSession')}
          >
            <LinearGradient colors={colors.gradient.success} style={styles.actionIcon}>
              <Feather name="activity" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionText}>Quick workout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Progress')}>
            <LinearGradient colors={colors.gradient.warning} style={styles.actionIcon}>
              <Feather name="gift" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionText}>Redeem rewards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Profile')}>
            <LinearGradient colors={['#60A5FA', '#38BDF8']} style={styles.actionIcon}>
              <Feather name="shield" size={18} color="#fff" />
            </LinearGradient>
            <Text style={styles.actionText}>Privacy mode</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Weekly activity</Text>
          <View style={styles.weeklyBadge}>
            <Text style={styles.weeklyBadgeText}>+{weeklyData.reduce((sum, d) => sum + d.points, 0)} HP</Text>
          </View>
        </View>
        <View style={styles.weeklyChart}>
          {weeklyData.map((day) => {
            const heightPercent = (day.points / 200) * 100;
            return (
              <View key={day.id} style={styles.weeklyBarContainer}>
                <View style={styles.weeklyBarTrack}>
                  <LinearGradient
                    colors={colors.gradient.success}
                    style={[styles.weeklyBarFill, { height: `${heightPercent}%` }]}
                  />
                </View>
                <Text style={styles.weeklyLabel}>{day.day}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.base },
  scrollContent: { paddingBottom: 32 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 6 },
  streakCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  streakValue: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 4 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  streakBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, padding: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { fontSize: 11, color: colors.text.secondary },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginTop: 6 },
  sectionHeader: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  linkText: { fontSize: 12, fontWeight: '600', color: colors.primary.teal },
  recommendCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recommendHeader: {
    height: 120,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recommendEmoji: { fontSize: 48 },
  recommendBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  recommendBadgeText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  recommendBody: { padding: 16 },
  recommendTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  recommendDesc: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },
  recommendMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  metaText: { fontSize: 11, color: colors.text.secondary },
  metaDivider: { marginHorizontal: 6, color: colors.text.tertiary },
  primaryButton: { borderRadius: 9999, marginTop: 14 },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  actionCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { marginTop: 8, fontSize: 11, fontWeight: '600', color: colors.text.primary },
  weeklyBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  weeklyBadgeText: { fontSize: 11, color: colors.primary.teal, fontWeight: '600' },
  weeklyChart: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyBarContainer: { alignItems: 'center', flex: 1 },
  weeklyBarTrack: {
    height: 120,
    width: 12,
    backgroundColor: colors.background.muted,
    borderRadius: 9999,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  weeklyBarFill: { width: '100%', borderRadius: 9999 },
  weeklyLabel: { fontSize: 10, color: colors.text.secondary, marginTop: 8 },
});
