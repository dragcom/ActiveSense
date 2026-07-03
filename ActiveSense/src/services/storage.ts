import AsyncStorage from '@react-native-async-storage/async-storage';
import { RewardVoucher, UserProfile, UserStats, WeeklyActivity, WorkoutSession } from '../types';
import { normalizeAvatarConfig } from '../data/avatars';
import { getCurrentSupabaseUserId, supabase } from './supabase';

// These keys are the local prototype storage names used by AsyncStorage.
const USER_PROFILE_KEY = 'user_profile';
const ONBOARDING_KEY = 'onboarding_completed';
const USER_STATS_KEY = 'user_stats';
const WORKOUT_SESSIONS_KEY = 'workout_sessions';
const REDEEMED_VOUCHERS_KEY = 'redeemed_vouchers';
const LAST_WORKOUT_DATE_KEY = 'last_workout_date';

export const defaultStats: UserStats = {
  healthpoints: 0,
  streakDays: 0,
  totalWorkouts: 0,
};

// The weekly chart is displayed Monday through Sunday.
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Keep JSON parsing errors readable when stored data is malformed.
const parseJSON = <T>(value: string, context: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Failed to parse ${context}.`);
  }
};

// Supabase stores privacy_mode in lowercase while the app displays title case.
const normalizePrivacyMode = (privacyMode?: string): UserProfile['privacyMode'] =>
  privacyMode?.toLowerCase() === 'camera' ? 'Camera' : 'Avatar';

const isMissingAvatarConfigColumn = (error: any) =>
  Boolean(error?.message?.includes('avatar_config') || error?.details?.includes('avatar_config'));

const getLocalDateKey = (date: Date) => date.toISOString().slice(0, 10);

// Convert a Supabase user_profiles row into the app's UserProfile type.
const toUserProfile = (row: any): UserProfile => ({
  name: row.display_name ?? '',
  age: row.age ?? 0,
  fitnessLevel: row.fitness_level ?? 'Beginner',
  medicalConditions: row.medical_conditions ?? ['None'],
  preferredIntensity: row.preferred_intensity ?? 'Low',
  createdAt: row.created_at ?? new Date().toISOString(),
  privacyMode: normalizePrivacyMode(row.privacy_mode),
  avatar: normalizeAvatarConfig(row.avatar_config),
});

// Convert a Supabase user_stats row into the counters shown throughout the app.
const toUserStats = (row: any): UserStats => ({
  healthpoints: row?.healthpoints ?? defaultStats.healthpoints,
  streakDays: row?.streak_days ?? defaultStats.streakDays,
  totalWorkouts: row?.total_workouts ?? defaultStats.totalWorkouts,
});

// Save or update the user's profile and mark onboarding as complete.
export const saveUserProfile = async (profile: UserProfile) => {
  const existing = await getUserProfile();
  await AsyncStorage.setItem(
    USER_PROFILE_KEY,
    JSON.stringify({
      ...profile,
      createdAt: profile.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
      privacyMode: profile.privacyMode ?? existing?.privacyMode ?? 'Avatar',
      avatar: normalizeAvatarConfig(profile.avatar ?? existing?.avatar),
    }),
  );
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');

  // When the user is authenticated, keep Supabase as the source of truth too.
  const userId = await getCurrentSupabaseUserId();
  if (supabase && userId) {
    const avatar = normalizeAvatarConfig(profile.avatar ?? existing?.avatar);
    const profilePayload = {
      id: userId,
      display_name: profile.name.trim(),
      age: profile.age,
      fitness_level: profile.fitnessLevel,
      preferred_intensity: profile.preferredIntensity,
      medical_conditions: profile.medicalConditions,
      privacy_mode: (profile.privacyMode ?? 'Avatar').toLowerCase(),
      avatar_config: avatar,
      updated_at: new Date().toISOString(),
    };
    let { error: profileError } = await supabase.from('user_profiles').upsert(profilePayload);
    if (isMissingAvatarConfigColumn(profileError)) {
      // Remote databases from older prototypes may not have avatar_config yet; local storage still keeps it.
      const legacyProfilePayload = {
        id: profilePayload.id,
        display_name: profilePayload.display_name,
        age: profilePayload.age,
        fitness_level: profilePayload.fitness_level,
        preferred_intensity: profilePayload.preferred_intensity,
        medical_conditions: profilePayload.medical_conditions,
        privacy_mode: profilePayload.privacy_mode,
        updated_at: profilePayload.updated_at,
      };
      const retry = await supabase.from('user_profiles').upsert(legacyProfilePayload);
      profileError = retry.error;
    }
    if (profileError) {
      throw profileError;
    }

    // Ensure the stats row exists before workouts or redemptions try to update it.
    const { error: statsError } = await supabase.from('user_stats').upsert({
      user_id: userId,
      healthpoints: defaultStats.healthpoints,
      streak_days: defaultStats.streakDays,
      total_workouts: defaultStats.totalWorkouts,
    }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (statsError) {
      throw statsError;
    }
  }
};

// Read the profile back with safe defaults for older saved data.
export const getUserProfile = async (): Promise<UserProfile | null> => {
  // Prefer Supabase for authenticated users so profile edits sync across devices.
  const userId = await getCurrentSupabaseUserId();
  if (supabase && userId) {
    const profileRead = await supabase
      .from('user_profiles')
      .select('display_name, age, fitness_level, preferred_intensity, medical_conditions, privacy_mode, avatar_config, created_at')
      .eq('id', userId)
      .maybeSingle();
    let data: any = profileRead.data;
    let error: any = profileRead.error;
    if (isMissingAvatarConfigColumn(error)) {
      // Keep older Supabase projects usable until db/schema.sql has been applied.
      const retry = await supabase
        .from('user_profiles')
        .select('display_name, age, fitness_level, preferred_intensity, medical_conditions, privacy_mode, created_at')
        .eq('id', userId)
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      throw error;
    }
    if (data) {
      return toUserProfile(data);
    }
  }

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
    avatar: normalizeAvatarConfig(parsed.avatar),
  };
};

// The app uses this flag to skip onboarding on later launches.
export const hasCompletedOnboarding = async (): Promise<boolean> => {
  const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
  return completed === 'true';
};

// Logout for the prototype clears local demo state and signs out Supabase when configured.
export const clearUserProfile = async () => {
  if (supabase) {
    await supabase.auth.signOut();
  }
  await Promise.all([
    AsyncStorage.removeItem(USER_PROFILE_KEY),
    AsyncStorage.removeItem(ONBOARDING_KEY),
    AsyncStorage.removeItem(USER_STATS_KEY),
    AsyncStorage.removeItem(WORKOUT_SESSIONS_KEY),
    AsyncStorage.removeItem(REDEEMED_VOUCHERS_KEY),
    AsyncStorage.removeItem(LAST_WORKOUT_DATE_KEY),
  ]);
};

// Stats come from Supabase when authenticated, with local fallback for offline prototype runs.
export const getStats = async (): Promise<UserStats> => {
  // Authenticated users read points and streaks from Supabase.
  const userId = await getCurrentSupabaseUserId();
  if (supabase && userId) {
    const { data, error } = await supabase
      .from('user_stats')
      .select('healthpoints, streak_days, total_workouts')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      return toUserStats(data);
    }
  }

  const stats = await AsyncStorage.getItem(USER_STATS_KEY);
  if (!stats) {
    return defaultStats;
  }
  const parsed = parseJSON<Partial<UserStats>>(stats, 'user stats');
  return { ...defaultStats, ...parsed };
};

// Store the latest Healthpoints, streak, and workout totals.
export const saveStats = async (stats: UserStats) => {
  // This method remains for local fallback screens; Supabase point changes should use RPCs.
  const userId = await getCurrentSupabaseUserId();
  if (supabase && userId) {
    const { error } = await supabase.from('user_stats').upsert({
      user_id: userId,
      healthpoints: stats.healthpoints,
      streak_days: stats.streakDays,
      total_workouts: stats.totalWorkouts,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      throw error;
    }
  }
  await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(stats));
};

// Workout sessions power history and weekly activity summaries.
export const getWorkoutSessions = async (): Promise<WorkoutSession[]> => {
  // Authenticated users read workout history from Supabase.
  const userId = await getCurrentSupabaseUserId();
  if (supabase && userId) {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id, workout_id, points_earned, completed_at, pose_landmark_count, processed_locally')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });
    if (error) {
      throw error;
    }
    return (data ?? []).map((session: any) => ({
      id: session.id,
      workoutId: session.workout_id ?? undefined,
      pointsEarned: session.points_earned,
      poseLandmarkCount: session.pose_landmark_count ?? undefined,
      completedAt: session.completed_at,
      processedLocally: session.processed_locally,
    }));
  }

  const sessions = await AsyncStorage.getItem(WORKOUT_SESSIONS_KEY);
  return sessions ? parseJSON<WorkoutSession[]>(sessions, 'workout sessions') : [];
};

// Save the full session list after adding or editing entries.
export const saveWorkoutSessions = async (sessions: WorkoutSession[]) => {
  await AsyncStorage.setItem(WORKOUT_SESSIONS_KEY, JSON.stringify(sessions));
};

// Add one completed workout and update the user's local progress counters.
export const addWorkoutResult = async (
  pointsEarned: number,
  workoutId?: number,
  poseLandmarkCount?: number,
) => {
  const clientSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Supabase uses an RPC so session insert and point award happen in one transaction.
  const userId = await getCurrentSupabaseUserId();
  if (supabase && userId) {
    const { data, error } = await supabase.rpc('complete_workout', {
      p_workout_id: workoutId ?? null,
      p_points_earned: pointsEarned,
      p_pose_landmark_count: poseLandmarkCount ?? null,
      p_client_session_id: clientSessionId,
    });
    if (error) {
      throw error;
    }
    const updated = toUserStats(Array.isArray(data) ? data[0] : data);
    await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(updated));
    return updated;
  }

  const current = await getStats();
  const updated: UserStats = {
    ...current,
    healthpoints: current.healthpoints + pointsEarned,
    totalWorkouts: current.totalWorkouts + 1,
    streakDays: (await AsyncStorage.getItem(LAST_WORKOUT_DATE_KEY)) === getLocalDateKey(new Date())
      ? current.streakDays
      : current.streakDays + 1,
  };
  const sessions = await getWorkoutSessions();
  const nextSession: WorkoutSession = {
    id: clientSessionId,
    workoutId,
    pointsEarned,
    poseLandmarkCount,
    completedAt: new Date().toISOString(),
    processedLocally: true,
  };
  await saveStats(updated);
  await AsyncStorage.setItem(LAST_WORKOUT_DATE_KEY, getLocalDateKey(new Date()));
  await saveWorkoutSessions([nextSession, ...sessions]);
  return updated;
};

// Convert saved sessions into seven chart bars for the current week.
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

// Reward redemption state is local for the prototype rewards shop.
export const getRedeemedVouchers = async (): Promise<number[]> => {
  // Authenticated users read redeemed vouchers from Supabase.
  const userId = await getCurrentSupabaseUserId();
  if (supabase && userId) {
    const { data, error } = await supabase
      .from('voucher_redemptions')
      .select('voucher_id')
      .eq('user_id', userId);
    if (error) {
      throw error;
    }
    return (data ?? []).map((row: any) => row.voucher_id);
  }

  const vouchers = await AsyncStorage.getItem(REDEEMED_VOUCHERS_KEY);
  return vouchers ? parseJSON<number[]>(vouchers, 'redeemed vouchers') : [];
};

// Persist which vouchers have already been redeemed on this device.
export const saveRedeemedVouchers = async (voucherIds: number[]) => {
  await AsyncStorage.setItem(REDEEMED_VOUCHERS_KEY, JSON.stringify(voucherIds));
};

// Redeem one voucher and deduct points through a database transaction when possible.
export const redeemVoucher = async (
  voucher: RewardVoucher,
): Promise<{ stats: UserStats; redeemedVoucherIds: number[] }> => {
  const userId = await getCurrentSupabaseUserId();
  if (supabase && userId) {
    const { data, error } = await supabase.rpc('redeem_voucher', {
      p_voucher_id: voucher.id,
    });
    if (error) {
      throw error;
    }
    const stats = toUserStats(Array.isArray(data) ? data[0] : data);
    const redeemedVoucherIds = await getRedeemedVouchers();
    await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(stats));
    await AsyncStorage.setItem(REDEEMED_VOUCHERS_KEY, JSON.stringify(redeemedVoucherIds));
    return { stats, redeemedVoucherIds };
  }

  // Local fallback mirrors the RPC behavior for simulator runs before Supabase Auth is wired.
  const current = await getStats();
  const redeemedVoucherIds = await getRedeemedVouchers();
  if (redeemedVoucherIds.includes(voucher.id)) {
    return { stats: current, redeemedVoucherIds };
  }
  if (current.healthpoints < voucher.points) {
    throw new Error('Not enough Healthpoints to redeem this reward.');
  }
  const stats = { ...current, healthpoints: current.healthpoints - voucher.points };
  const nextRedeemedVoucherIds = [...redeemedVoucherIds, voucher.id];
  await saveStats(stats);
  await saveRedeemedVouchers(nextRedeemedVoucherIds);
  return { stats, redeemedVoucherIds: nextRedeemedVoucherIds };
};
