import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, UserStats } from '../types';

const USER_PROFILE_KEY = 'user_profile';
const ONBOARDING_KEY = 'onboarding_completed';
const USER_STATS_KEY = 'user_stats';

export const defaultStats: UserStats = {
  healthpoints: 1250,
  streakDays: 7,
  totalWorkouts: 12,
};

const parseJSON = <T>(value: string, context: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Failed to parse ${context}.`);
  }
};

export const saveUserProfile = async (profile: UserProfile) => {
  await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
  const profile = await AsyncStorage.getItem(USER_PROFILE_KEY);
  if (!profile) {
    return null;
  }
  return parseJSON<UserProfile>(profile, 'user profile');
};

export const hasCompletedOnboarding = async (): Promise<boolean> => {
  const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
  return completed === 'true';
};

export const clearUserProfile = async () => {
  await AsyncStorage.multiRemove([USER_PROFILE_KEY, ONBOARDING_KEY]);
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

export const addWorkoutResult = async (pointsEarned: number) => {
  const current = await getStats();
  const updated: UserStats = {
    ...current,
    healthpoints: current.healthpoints + pointsEarned,
    totalWorkouts: current.totalWorkouts + 1,
    streakDays: current.streakDays + 1,
  };
  await saveStats(updated);
  return updated;
};
