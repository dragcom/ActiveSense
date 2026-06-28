import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, UserStats, WeeklyActivity, WorkoutSession } from '../types';

const USER_PROFILE_KEY = 'user_profile';
const ONBOARDING_KEY = 'onboarding_completed';
const USER_STATS_KEY = 'user_stats';
const WORKOUT_SESSIONS_KEY = 'workout_sessions';
const REDEEMED_VOUCHERS_KEY = 'redeemed_vouchers';

export const defaultStats: UserStats = {
  healthpoints: 0,
  streakDays: 0,
  totalWorkouts: 0,
};

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const parseJSON = <T>(value: string, context: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Failed to parse ${context}.`);
  }
};

export const saveUserProfile = async (profile: UserProfile) => {
  const existing = await getUserProfile();
  await AsyncStorage.setItem(
    USER_PROFILE_KEY,
    JSON.stringify({
      ...profile,
      createdAt: profile.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
      privacyMode: profile.privacyMode ?? existing?.privacyMode ?? 'Avatar',
    }),
  );
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
  const profile = await AsyncStorage.getItem(USER_PROFILE_KEY);
  if (!profile) {
    return null;
  }
  const parsed = parseJSON<Partial<UserProfile>>(profile, 'user profile');
  return {
    name: parsed.name ?? '',
    age: parsed.age ?? 0,
    fitnessLevel: parsed.fitnessLevel ?? 'Beginner',
    medicalConditions: parsed.medicalConditions ?? ['None'],
    preferredIntensity: parsed.preferredIntensity ?? 'Low',
    createdAt: parsed.createdAt ?? new Date().toISOString(),
    privacyMode: parsed.privacyMode ?? 'Avatar',
  };
};

export const hasCompletedOnboarding = async (): Promise<boolean> => {
  const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
  return completed === 'true';
};

export const clearUserProfile = async () => {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
};

export const getStats = async (): Promise<UserStats> => {
  const stats = await AsyncStorage.getItem(USER_STATS_KEY);
  if (!stats) {
    return defaultStats;
  }
  const parsed = parseJSON<Partial<UserStats>>(stats, 'user stats');
  return { ...defaultStats, ...parsed };
};

export const saveStats = async (stats: UserStats) => {
  await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(stats));
};

export const getWorkoutSessions = async (): Promise<WorkoutSession[]> => {
  const sessions = await AsyncStorage.getItem(WORKOUT_SESSIONS_KEY);
  return sessions ? parseJSON<WorkoutSession[]>(sessions, 'workout sessions') : [];
};

export const saveWorkoutSessions = async (sessions: WorkoutSession[]) => {
  await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(sessions));
};

export const addWorkoutResult = async (
  pointsEarned: number,
  workoutId?: number,
  poseLandmarkCount?: number,
) => {
  const current = await getStats();
  const updated: UserStats = {
    ...current,
    healthpoints: current.healthpoints + pointsEarned,
    totalWorkouts: current.totalWorkouts + 1,
    streakDays: current.streakDays + 1,
  };
  const sessions = await getWorkoutSessions();
  const nextSession: WorkoutSession = {
    id: `${Date.now()}`,
    workoutId,
    pointsEarned,
    poseLandmarkCount,
    completedAt: new Date().toISOString(),
    processedLocally: true,
  };
  await saveStats(updated);
  await saveWorkoutSessions([nextSession, ...sessions]);
  return updated;
};

export const getWeeklyActivity = async (): Promise<WeeklyActivity[]> => {
  const sessions = await getWorkoutSessions();
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + mondayOffset);

  return weekdays.map((weekday, index) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + index);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    const points = sessions
      .filter((session) => {
        const completedAt = new Date(session.completedAt);
        return completedAt >= start && completedAt < end;
      })
      .reduce((sum, session) => sum + session.pointsEarned, 0);

    return { id: weekday.toLowerCase(), day: weekday, points };
  });
};

export const getRedeemedVouchers = async (): Promise<number[]> => {
  const vouchers = await AsyncStorage.getItem(REDEEMED_VOUCHERS_KEY);
  return vouchers ? parseJSON<number[]>(vouchers, 'redeemed vouchers') : [];
};

export const saveRedeemedVouchers = async (voucherIds: number[]) => {
  await AsyncStorage.setItem(REDEEMED_VOUCHERS_KEY, JSON.stringify(voucherIds));
};
