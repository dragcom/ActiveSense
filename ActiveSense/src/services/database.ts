import {
  Achievement,
  OnboardingChoices,
  ProfileMenuItem,
  PoseTrainingSample,
  RewardVoucher,
  UserProfile,
  UserStats,
  Workout,
  WorkoutExercise,
} from '../types';
import {
  fallbackAchievements,
  fallbackDashboardSettings,
  fallbackDefaultWorkoutId,
  fallbackInfoPages,
  fallbackOnboardingChoices,
  fallbackPoseTrainingSamples,
  fallbackProfileGoals,
  fallbackProfileMenuItems,
  fallbackRewardVouchers,
  fallbackWorkoutCategories,
  fallbackWorkoutExercises,
  fallbackWorkouts,
} from './fallbackData';
import { hasSupabaseConfig, requireSupabase } from './supabase';

// WorkoutRow is the exact database shape returned by the workouts table.
type WorkoutRow = {
  id: number;
  title: string;
  duration_minutes: number;
  difficulty: string;
  calories: number;
  category_id: number;
  emoji: string;
  gradient_start: string;
  gradient_end: string;
  description: string;
  intensity: string;
  recommended_min_age?: number | null;
  recommended_max_age?: number | null;
  is_active?: boolean;
  workout_categories?: { name: string } | null;
};

// WorkoutExerciseRow keeps SQL snake_case separate from the app's camelCase type.
type WorkoutExerciseRow = {
  id: number;
  workout_id: number;
  name: string;
  sets: number;
  reps: number;
  points: number;
  sort_order: number;
  target_landmarks: number;
  pose_class: WorkoutExercise['poseClass'];
  feedback_prompt: string;
};

type AppOptionRow = {
  id: number;
  label: string;
  value?: string | null;
  metadata?: Record<string, unknown> | null;
  app_option_groups?: {
    key: string;
    label: string;
    group_type: 'onboarding' | 'medical_condition' | 'profile';
  } | null;
  sort_order: number;
};

// Supabase stores achievements with SQL-friendly column names.
type AchievementRow = {
  id: number;
  title: string;
  emoji: string;
  description: string;
  requirement_type: string;
  requirement_value: number;
  sort_order: number;
};

// RewardVoucherRow is the shop row before it is mapped to UI field names.
type RewardVoucherRow = {
  id: number;
  name: string;
  points: number;
  emoji: string;
  category: string;
};

// Profile menu rows drive the Settings-style list on the Profile screen.
type ProfileMenuRow = {
  id: number;
  label: string;
  value?: ProfileMenuItem['actionKey'] | null;
  metadata?: Record<string, unknown> | null;
  sort_order: number;
};

// Pose samples are read from Supabase so classifier training data is no longer hardcoded.
type PoseTrainingSampleRow = {
  id: number;
  label: PoseTrainingSample['label'];
  features: number[];
};

// Info pages are loaded from Supabase so Profile copy stays editable in data.
type InfoPageRow = {
  action_key: string;
  title: string;
  icon: string;
  body: string;
};

const validPoseLabels: PoseTrainingSample['label'][] = [
  'squat',
  'pushup',
  'lunge',
];

// The pose classifier currently extracts ten numeric features from each 33-point frame.
const expectedPoseFeatureCount = 10;

// Catalog screens should not crash if a bad color lands in Supabase.
const safeColor = (value: string | null | undefined, fallback: string) =>
  /^#[0-9A-Fa-f]{6}$/.test(value ?? '') ? (value as string) : fallback;

const metadataString = (metadata: Record<string, unknown> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
};

// Database requirement names are snake_case, while the app state is camelCase.
const statKeyFromDatabase = (value: string): keyof UserStats => {
  if (value === 'healthpoints') {
    return 'healthpoints';
  }
  if (value === 'streak_days') {
    return 'streakDays';
  }
  if (value === 'total_workouts') {
    return 'totalWorkouts';
  }
  return 'totalWorkouts';
};

// Local fallback is only for prototype runs without Supabase env. Configured builds must use Supabase data.
const readOrFallback = async <T>(label: string, fallback: T, read: () => Promise<T>) => {
  if (!hasSupabaseConfig) {
    return fallback;
  }
  try {
    return await read();
  } catch (error) {
    console.error(`Unable to load ${label} from Supabase.`, error);
    throw error;
  }
};

// Convert database rows into the card-friendly Workout type used by screens.
const toWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  title: row.title,
  duration: `${row.duration_minutes} min`,
  difficulty: row.difficulty,
  calories: `${row.calories} cal`,
  category: row.workout_categories?.name ?? 'Uncategorized',
  emoji: row.emoji,
  gradient: [safeColor(row.gradient_start, '#14B8A6'), safeColor(row.gradient_end, '#06B6D4')],
  description: row.description,
  intensity: row.intensity,
});

// Convert exercise rows into the shape consumed by WorkoutSessionScreen.
const toWorkoutExercise = (row: WorkoutExerciseRow): WorkoutExercise => ({
  id: row.id,
  workoutId: row.workout_id,
  name: row.name,
  sets: row.sets,
  reps: row.reps,
  points: row.points,
  sortOrder: row.sort_order,
  targetLandmarks: row.target_landmarks,
  poseClass: row.pose_class,
  feedbackPrompt: row.feedback_prompt,
});

// Convert achievement rows and compute unlocked state from current stats.
const toAchievement = (row: AchievementRow, stats: UserStats): Achievement & { unlocked: boolean } => ({
  id: row.id,
  title: row.title,
  emoji: row.emoji,
  desc: row.description,
  requirementType: statKeyFromDatabase(row.requirement_type),
  requirementValue: row.requirement_value,
  unlocked: stats[statKeyFromDatabase(row.requirement_type)] >= row.requirement_value,
});

// Add unlocked state to fallback achievement rows too.
const fallbackAchievementsForStats = (stats: UserStats) =>
  fallbackAchievements.map((achievement) => ({
    ...achievement,
    unlocked: stats[achievement.requirementType] >= achievement.requirementValue,
  }));

// Recommended workout fallback uses the same profile ranking idea as Supabase rows.
const fallbackRecommendedWorkout = (profile: UserProfile | null) => {
  const [first] = [...fallbackWorkouts].sort((a, b) => {
    const score = (workout: Workout) =>
      (profile?.fitnessLevel === workout.difficulty ? 4 : 0) +
      (profile?.preferredIntensity === workout.intensity ? 3 : 0) +
      (profile && profile.age >= 55 && workout.category === 'Senior' ? 5 : 0);
    return score(b) - score(a);
  });
  return first ?? fallbackWorkouts[0];
};

// Score workouts against the user's profile so Home can pick a recommendation from database rows.
const rankWorkoutForProfile = (profile: UserProfile | null) => (row: WorkoutRow) => {
  let score = 0;
  if (!profile) {
    return score;
  }
  if (row.difficulty === profile.fitnessLevel) {
    score += 4;
  }
  if (row.intensity === profile.preferredIntensity) {
    score += 3;
  }
  if (profile.age >= 55 && row.recommended_min_age) {
    score += 5;
  }
  if (profile.age < 55 && row.recommended_max_age) {
    score += 2;
  }
  return score;
};

// Throw a helpful error when Supabase returns a failed response.
const assertNoError = (error: unknown) => {
  if (error) {
    throw error;
  }
};

const requireRows = <T>(label: string, rows: T[]) => {
  if (!rows.length) {
    throw new Error(`Supabase returned no ${label}. Run db/seed.sql for the ActiveSense project.`);
  }
  return rows;
};

// db is the app's database facade; screens call this instead of talking to Supabase directly.
export const db = {
  // Return filter chips for the Workouts screen from the categories table.
  async getWorkoutCategories() {
    return readOrFallback('workout categories', fallbackWorkoutCategories, async () => {
      const { data, error } = await requireSupabase()
        .from('workouts')
        .select('workout_categories(name)')
        .eq('is_active', true)
        .order('id', { ascending: true });
      assertNoError(error);
      const categories = Array.from(
        new Set(
          ((data as Array<{ workout_categories?: { name: string } | null }> | null) ?? [])
            .map((workout) => workout.workout_categories?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      );
      return ['All', ...categories];
    });
  },

  // Return all active workout cards from Supabase.
  async getWorkouts() {
    return readOrFallback('workouts', fallbackWorkouts, async () => {
      const { data, error } = await requireSupabase()
        .from('workouts')
        .select('id, title, duration_minutes, difficulty, calories, category_id, emoji, gradient_start, gradient_end, description, intensity, recommended_min_age, recommended_max_age, is_active, workout_categories(name)')
        .eq('is_active', true)
        .order('id', { ascending: true });
      assertNoError(error);
      const workouts = ((data as WorkoutRow[] | null) ?? []).map(toWorkout);
      return requireRows('workouts', workouts);
    });
  },

  // Pick the best workout for the user's age, level, and intensity preference.
  async getRecommendedWorkout(profile: UserProfile | null) {
    return readOrFallback('recommended workout', fallbackRecommendedWorkout(profile), async () => {
      const { data, error } = await requireSupabase()
        .from('workouts')
        .select('id, title, duration_minutes, difficulty, calories, category_id, emoji, gradient_start, gradient_end, description, intensity, recommended_min_age, recommended_max_age, is_active, workout_categories(name)')
        .eq('is_active', true)
        .order('id', { ascending: true });
      assertNoError(error);
      const rows = (data as WorkoutRow[] | null) ?? [];
      const [first] = [...rows].sort(
        (a, b) => rankWorkoutForProfile(profile)(b) - rankWorkoutForProfile(profile)(a),
      );
      if (!first) {
        throw new Error('Supabase returned no recommended workout. Run db/seed.sql for the ActiveSense project.');
      }
      return toWorkout(first);
    });
  },

  // Return exercises for one workout; quick workout mode uses app_settings.default_workout_id or the first workout.
  async getWorkoutExercises(workoutId?: number) {
    const fallbackWorkoutId = workoutId ?? fallbackDefaultWorkoutId;
    const fallbackExercises = fallbackWorkoutExercises.filter((exercise) => exercise.workoutId === fallbackWorkoutId);
    return readOrFallback('workout exercises', fallbackExercises, async () => {
      const client = requireSupabase();
      let selectedWorkoutId = workoutId;

      if (!selectedWorkoutId) {
        const { data: setting, error: settingError } = await client
          .from('app_settings')
          .select('value')
          .eq('key', 'default_workout_id')
          .maybeSingle();
        assertNoError(settingError);
        selectedWorkoutId = Number((setting?.value as { workout_id?: number } | null)?.workout_id);
      }

      if (!selectedWorkoutId) {
        const { data: firstWorkout, error: firstWorkoutError } = await client
          .from('workouts')
          .select('id')
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();
        assertNoError(firstWorkoutError);
        selectedWorkoutId = Number(firstWorkout?.id);
      }

      const { data, error } = await client
        .from('workout_exercises')
        .select('id, workout_id, name, sets, reps, points, sort_order, target_landmarks, pose_class, feedback_prompt')
        .eq('workout_id', selectedWorkoutId)
        .order('sort_order', { ascending: true });
      assertNoError(error);
      const exercises = ((data as WorkoutExerciseRow[] | null) ?? []).map(toWorkoutExercise);
      return requireRows('workout exercises', exercises);
    });
  },

  // The workout session uses these database samples to classify live landmarks.
  async getPoseTrainingSamples() {
    return readOrFallback('pose training samples', fallbackPoseTrainingSamples, async () => {
      const { data, error } = await requireSupabase()
        .from('pose_training_samples')
        .select('id, label, features')
        .order('id', { ascending: true });
      assertNoError(error);
      const samples = ((data as PoseTrainingSampleRow[] | null) ?? [])
        .filter((sample) =>
          validPoseLabels.includes(sample.label) &&
          Array.isArray(sample.features) &&
          sample.features.length === expectedPoseFeatureCount &&
          sample.features.every(Number.isFinite),
        )
        .map((sample) => ({
          id: sample.id,
          label: sample.label,
          features: sample.features,
        }));
      return requireRows('pose training samples', samples);
    });
  },

  // Progress screen reads active rows for the reward shop.
  async getRewardVouchers() {
    return readOrFallback('reward vouchers', fallbackRewardVouchers, async () => {
      const { data, error } = await requireSupabase()
        .from('reward_vouchers')
        .select('id, name, points, emoji, category')
        .eq('is_active', true)
        .order('points', { ascending: true });
      assertNoError(error);
      const vouchers = ((data as RewardVoucherRow[] | null) ?? []).map((voucher) => ({
        id: voucher.id,
        name: voucher.name,
        points: voucher.points,
        emoji: voucher.emoji,
        category: voucher.category,
      }));
      return requireRows('reward vouchers', vouchers);
    });
  },

  // Add unlocked state to achievement definitions based on the user's stats.
  async getAchievements(stats: UserStats) {
    return readOrFallback('achievements', fallbackAchievementsForStats(stats), async () => {
      const { data, error } = await requireSupabase()
        .from('achievements')
        .select('id, title, emoji, description, requirement_type, requirement_value, sort_order')
        .order('sort_order', { ascending: true });
      assertNoError(error);
      const achievements = ((data as AchievementRow[] | null) ?? []).map((achievement) => toAchievement(achievement, stats));
      return requireRows('achievements', achievements);
    });
  },

  // Group onboarding choices into the exact arrays the screen expects.
  async getOnboardingChoices(): Promise<OnboardingChoices> {
    return readOrFallback('onboarding choices', fallbackOnboardingChoices, async () => {
      const client = requireSupabase();
      const [{ data: choices, error: choicesError }, { data: medicalOptions, error: medicalError }] = await Promise.all([
        client
          .from('app_options')
          .select('id, label, value, metadata, sort_order, app_option_groups!inner(key, label, group_type)')
          .eq('app_option_groups.group_type', 'onboarding')
          .order('sort_order', { ascending: true }),
        client
          .from('app_options')
          .select('id, label, value, metadata, sort_order, app_option_groups!inner(key, label, group_type)')
          .eq('app_option_groups.group_type', 'medical_condition')
          .order('sort_order', { ascending: true }),
      ]);
      assertNoError(choicesError);
      assertNoError(medicalError);

      const rows = (choices as AppOptionRow[] | null) ?? [];
      const result = {
        fitnessLevels: rows.filter((choice) => choice.app_option_groups?.key === 'fitness_level').map((choice) => choice.label),
        intensityLevels: rows.filter((choice) => choice.app_option_groups?.key === 'preferred_intensity').map((choice) => choice.label),
        medicalConditionOptions: ((medicalOptions as AppOptionRow[] | null) ?? []).map((option) => ({
          id: option.id,
          category: option.app_option_groups?.label ?? 'Other',
          label: option.label,
        })),
      };
      if (!result.fitnessLevels.length || !result.intensityLevels.length) {
        throw new Error('Supabase returned incomplete onboarding choices. Run db/seed.sql for the ActiveSense project.');
      }
      return result;
    });
  },

  // Profile screen displays these goals as database-backed chips.
  async getProfileGoals() {
    return readOrFallback('profile goals', fallbackProfileGoals, async () => {
      const { data, error } = await requireSupabase()
        .from('app_options')
        .select('label, sort_order, app_option_groups!inner(key)')
        .eq('app_option_groups.key', 'profile_goals')
        .order('sort_order', { ascending: true });
      assertNoError(error);
      const goals = ((data as Array<{ label: string }> | null) ?? []).map((goal) => goal.label);
      return requireRows('profile goals', goals);
    });
  },

  // Profile screen menu is data-driven so actions can be added without changing UI code.
  async getProfileMenuItems() {
    return readOrFallback('profile menu', fallbackProfileMenuItems, async () => {
      const { data, error } = await requireSupabase()
        .from('app_options')
        .select('id, label, value, metadata, sort_order, app_option_groups!inner(key)')
        .eq('app_option_groups.key', 'profile_menu_items')
        .order('sort_order', { ascending: true });
      assertNoError(error);
      const menu = ((data as ProfileMenuRow[] | null) ?? []).map((item) => ({
        id: item.id,
        icon: metadataString(item.metadata, 'icon') ?? 'settings',
        label: item.label,
        badge: metadataString(item.metadata, 'badge'),
        actionKey: item.value ?? undefined,
        color: safeColor(metadataString(item.metadata, 'color'), '#14B8A6'),
      }));
      return requireRows('profile menu items', menu);
    });
  },

  // Home reads dashboard settings such as the displayed daily goal from app_settings.
  async getDashboardSettings() {
    return readOrFallback('dashboard settings', fallbackDashboardSettings, async () => {
      const { data, error } = await requireSupabase()
        .from('app_settings')
        .select('value')
        .eq('key', 'dashboard_settings')
        .maybeSingle();
      assertNoError(error);
      const value = (data?.value as { goal_label?: string } | null) ?? {};
      return {
        goalLabel: value.goal_label ?? fallbackDashboardSettings.goalLabel,
      };
    });
  },

  // Profile and legal links resolve their title, icon, and body from app_pages.
  async getInfoPage(actionKey: string) {
    const fallback = fallbackInfoPages[actionKey] ?? {
      title: 'Information',
      icon: 'info',
      body: 'This page has not been configured in Supabase yet.',
    };
    return readOrFallback('info page', fallback, async () => {
      const { data, error } = await requireSupabase()
        .from('app_pages')
        .select('action_key, title, icon, body')
        .eq('action_key', actionKey)
        .eq('page_type', 'info')
        .maybeSingle();
      assertNoError(error);
      const page = data as InfoPageRow | null;
      return page
        ? {
            title: page.title,
            icon: page.icon,
            body: page.body,
          }
        : fallback;
    });
  },
};
