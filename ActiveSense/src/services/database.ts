import {
  Achievement,
  MedicalConditionOption,
  OnboardingChoices,
  ProfileMenuItem,
  RewardVoucher,
  UserProfile,
  UserStats,
  WeeklyActivity,
  Workout,
  WorkoutExercise,
} from '../types';

type WorkoutCategoryRow = {
  id: number;
  name: string;
  sortOrder: number;
};

type WorkoutRow = {
  id: number;
  title: string;
  durationMinutes: number;
  difficulty: string;
  calories: number;
  categoryId: number;
  emoji: string;
  gradientStart: string;
  gradientEnd: string;
  description: string;
  intensity: string;
  recommendedMinAge?: number;
  recommendedMaxAge?: number;
};

type OnboardingChoiceRow = {
  fieldName: 'fitness_level' | 'preferred_intensity';
  label: string;
  sortOrder: number;
};

type MedicalConditionOptionRow = MedicalConditionOption & {
  sortOrder: number;
};

const workoutCategoryRows: WorkoutCategoryRow[] = [
  { id: 1, name: 'Beginner', sortOrder: 10 },
  { id: 2, name: 'Senior', sortOrder: 20 },
  { id: 3, name: 'Cardio', sortOrder: 30 },
  { id: 4, name: 'Strength', sortOrder: 40 },
  { id: 5, name: 'Flexibility', sortOrder: 50 },
];

const workoutRows: WorkoutRow[] = [
  {
    id: 1,
    title: 'Gentle Morning Yoga',
    durationMinutes: 15,
    difficulty: 'Beginner',
    calories: 50,
    categoryId: 5,
    emoji: '🧘',
    gradientStart: '#A78BFA',
    gradientEnd: '#EC4899',
    description: 'Start your day with gentle stretches and mindful breathing.',
    intensity: 'Low',
  },
  {
    id: 2,
    title: 'Senior Seated Exercises',
    durationMinutes: 20,
    difficulty: 'Low Impact',
    calories: 60,
    categoryId: 2,
    emoji: '🪑',
    gradientStart: '#14B8A6',
    gradientEnd: '#06B6D4',
    description: 'Safe, effective chair-based movements for mobility.',
    intensity: 'Low',
    recommendedMinAge: 55,
  },
  {
    id: 3,
    title: 'Cardio Walk Burst',
    durationMinutes: 18,
    difficulty: 'Moderate',
    calories: 120,
    categoryId: 3,
    emoji: '🚶',
    gradientStart: '#2DD4BF',
    gradientEnd: '#22D3EE',
    description: 'Light cardio intervals to boost endurance and mood.',
    intensity: 'Medium',
  },
  {
    id: 4,
    title: 'Core Stability Basics',
    durationMinutes: 16,
    difficulty: 'Beginner',
    calories: 90,
    categoryId: 4,
    emoji: '🧠',
    gradientStart: '#FB923C',
    gradientEnd: '#F43F5E',
    description: 'Build a strong core with low-impact strength work.',
    intensity: 'Low',
  },
  {
    id: 5,
    title: 'Balance & Mobility',
    durationMinutes: 12,
    difficulty: 'Low Impact',
    calories: 45,
    categoryId: 2,
    emoji: '⚖️',
    gradientStart: '#60A5FA',
    gradientEnd: '#38BDF8',
    description: 'Improve balance with steady, confidence-building drills.',
    intensity: 'Low',
    recommendedMinAge: 55,
  },
  {
    id: 6,
    title: 'Low Impact HIIT',
    durationMinutes: 14,
    difficulty: 'Intermediate',
    calories: 140,
    categoryId: 3,
    emoji: '⚡',
    gradientStart: '#F97316',
    gradientEnd: '#EF4444',
    description: 'Short bursts of energy without the joint strain.',
    intensity: 'High',
    recommendedMaxAge: 55,
  },
  {
    id: 7,
    title: 'Resistance Band Flow',
    durationMinutes: 22,
    difficulty: 'Intermediate',
    calories: 160,
    categoryId: 4,
    emoji: '🎯',
    gradientStart: '#34D399',
    gradientEnd: '#10B981',
    description: 'Strengthen major muscle groups with gentle resistance.',
    intensity: 'Medium',
  },
  {
    id: 8,
    title: 'Evening Stretch Reset',
    durationMinutes: 10,
    difficulty: 'Beginner',
    calories: 35,
    categoryId: 5,
    emoji: '🌙',
    gradientStart: '#A78BFA',
    gradientEnd: '#818CF8',
    description: 'Wind down with soothing stretches and breath work.',
    intensity: 'Low',
  },
];

const workoutExerciseRows: WorkoutExercise[] = [
  { id: 1, workoutId: 1, name: 'Breathing Reset', sets: 1, reps: 5, points: 20, sortOrder: 10, targetLandmarks: 33, feedbackPrompt: 'Relax your shoulders and keep breathing steadily.' },
  { id: 2, workoutId: 1, name: 'Standing Forward Fold', sets: 2, reps: 6, points: 35, sortOrder: 20, targetLandmarks: 33, feedbackPrompt: 'Hinge gently and keep your knees soft.' },
  { id: 3, workoutId: 1, name: 'Seated Twist', sets: 2, reps: 8, points: 35, sortOrder: 30, targetLandmarks: 33, feedbackPrompt: 'Rotate slowly and keep your spine tall.' },
  { id: 4, workoutId: 2, name: 'Seated Marches', sets: 3, reps: 10, points: 45, sortOrder: 10, targetLandmarks: 33, feedbackPrompt: 'Lift one knee at a time and sit tall.' },
  { id: 5, workoutId: 2, name: 'Chair Arm Raises', sets: 2, reps: 12, points: 35, sortOrder: 20, targetLandmarks: 33, feedbackPrompt: 'Keep your shoulders relaxed as your arms rise.' },
  { id: 6, workoutId: 2, name: 'Ankle Circles', sets: 2, reps: 10, points: 20, sortOrder: 30, targetLandmarks: 33, feedbackPrompt: 'Move smoothly and avoid locking your knees.' },
  { id: 7, workoutId: 3, name: 'Walk In Place', sets: 3, reps: 20, points: 50, sortOrder: 10, targetLandmarks: 33, feedbackPrompt: 'Land softly and keep your chest open.' },
  { id: 8, workoutId: 3, name: 'Side Steps', sets: 3, reps: 12, points: 45, sortOrder: 20, targetLandmarks: 33, feedbackPrompt: 'Step wide enough to feel balanced.' },
  { id: 9, workoutId: 3, name: 'Heel Digs', sets: 2, reps: 16, points: 35, sortOrder: 30, targetLandmarks: 33, feedbackPrompt: 'Point your toes upward and move with control.' },
  { id: 10, workoutId: 4, name: 'Squats', sets: 3, reps: 10, points: 50, sortOrder: 10, targetLandmarks: 33, feedbackPrompt: 'Keep knees aligned with toes.' },
  { id: 11, workoutId: 4, name: 'Wall Push-ups', sets: 3, reps: 8, points: 40, sortOrder: 20, targetLandmarks: 33, feedbackPrompt: 'Keep your body long from shoulders to heels.' },
  { id: 12, workoutId: 4, name: 'Arm Circles', sets: 2, reps: 15, points: 30, sortOrder: 30, targetLandmarks: 33, feedbackPrompt: 'Small controlled circles, shoulders down.' },
  { id: 13, workoutId: 4, name: 'Leg Raises', sets: 3, reps: 10, points: 50, sortOrder: 40, targetLandmarks: 33, feedbackPrompt: 'Brace your core before lifting.' },
  { id: 14, workoutId: 4, name: 'Cool Down Stretch', sets: 1, reps: 1, points: 30, sortOrder: 50, targetLandmarks: 33, feedbackPrompt: 'Slow your breathing and ease into the stretch.' },
  { id: 15, workoutId: 5, name: 'Tandem Stand', sets: 3, reps: 8, points: 35, sortOrder: 10, targetLandmarks: 33, feedbackPrompt: 'Use a wall or chair nearby for confidence.' },
  { id: 16, workoutId: 5, name: 'Side Leg Lifts', sets: 2, reps: 10, points: 35, sortOrder: 20, targetLandmarks: 33, feedbackPrompt: 'Lift only as high as you can stay stable.' },
  { id: 17, workoutId: 5, name: 'Heel-to-Toe Walk', sets: 2, reps: 12, points: 30, sortOrder: 30, targetLandmarks: 33, feedbackPrompt: 'Move slowly and keep your gaze forward.' },
  { id: 18, workoutId: 6, name: 'Low Jacks', sets: 3, reps: 12, points: 50, sortOrder: 10, targetLandmarks: 33, feedbackPrompt: 'Step out instead of jumping.' },
  { id: 19, workoutId: 6, name: 'Fast Marches', sets: 3, reps: 18, points: 55, sortOrder: 20, targetLandmarks: 33, feedbackPrompt: 'Drive your arms and stay light on your feet.' },
  { id: 20, workoutId: 6, name: 'Squat Reach', sets: 2, reps: 10, points: 35, sortOrder: 30, targetLandmarks: 33, feedbackPrompt: 'Reach tall after each controlled squat.' },
  { id: 21, workoutId: 7, name: 'Band Rows', sets: 3, reps: 12, points: 55, sortOrder: 10, targetLandmarks: 33, feedbackPrompt: 'Pull elbows back without shrugging.' },
  { id: 22, workoutId: 7, name: 'Band Press', sets: 3, reps: 10, points: 50, sortOrder: 20, targetLandmarks: 33, feedbackPrompt: 'Press forward with steady wrists.' },
  { id: 23, workoutId: 7, name: 'Band Good Morning', sets: 2, reps: 10, points: 45, sortOrder: 30, targetLandmarks: 33, feedbackPrompt: 'Hinge at the hips and keep your back neutral.' },
  { id: 24, workoutId: 8, name: 'Neck Release', sets: 1, reps: 6, points: 15, sortOrder: 10, targetLandmarks: 33, feedbackPrompt: 'Move slowly and avoid forcing range.' },
  { id: 25, workoutId: 8, name: 'Hamstring Stretch', sets: 2, reps: 6, points: 20, sortOrder: 20, targetLandmarks: 33, feedbackPrompt: 'Keep the stretch gentle and even.' },
  { id: 26, workoutId: 8, name: 'Child Pose Breathing', sets: 1, reps: 5, points: 20, sortOrder: 30, targetLandmarks: 33, feedbackPrompt: 'Let each breath soften your back.' },
];

const voucherRows: RewardVoucher[] = [
  { id: 1, name: 'FairPrice $5 Voucher', points: 500, emoji: '🛒', category: 'Groceries' },
  { id: 2, name: 'GrabFood $10 Voucher', points: 1000, emoji: '🍔', category: 'Food' },
  { id: 3, name: 'Guardian $5 Voucher', points: 500, emoji: '💊', category: 'Health' },
  { id: 4, name: 'Decathlon $15 Voucher', points: 1500, emoji: '⚽', category: 'Sports' },
];

const achievementRows: Achievement[] = [
  { id: 1, title: '7-Day Streak', emoji: '🔥', desc: 'Complete 7 days in a row', requirementType: 'streakDays', requirementValue: 7 },
  { id: 2, title: 'First Workout', emoji: '🎯', desc: 'Finish your first session', requirementType: 'totalWorkouts', requirementValue: 1 },
  { id: 3, title: '1000 Points', emoji: '💯', desc: 'Earn 1000 Healthpoints', requirementType: 'healthpoints', requirementValue: 1000 },
  { id: 4, title: '30-Day Streak', emoji: '🏆', desc: 'Complete 30 consecutive days', requirementType: 'streakDays', requirementValue: 30 },
];

const onboardingChoiceRows: OnboardingChoiceRow[] = [
  { fieldName: 'fitness_level', label: 'Beginner', sortOrder: 10 },
  { fieldName: 'fitness_level', label: 'Intermediate', sortOrder: 20 },
  { fieldName: 'fitness_level', label: 'Advanced', sortOrder: 30 },
  { fieldName: 'fitness_level', label: 'Low Impact', sortOrder: 40 },
  { fieldName: 'preferred_intensity', label: 'Low', sortOrder: 10 },
  { fieldName: 'preferred_intensity', label: 'Medium', sortOrder: 20 },
  { fieldName: 'preferred_intensity', label: 'High', sortOrder: 30 },
];

const medicalConditionRows: MedicalConditionOptionRow[] = [
  { id: 1, category: 'General', label: 'None', sortOrder: 10 },
  { id: 2, category: 'Mobility & Joint', label: 'Knee pain', sortOrder: 20 },
  { id: 3, category: 'Mobility & Joint', label: 'Back pain', sortOrder: 30 },
  { id: 4, category: 'Mobility & Joint', label: 'Arthritis', sortOrder: 40 },
  { id: 5, category: 'Mobility & Joint', label: 'Balance concerns', sortOrder: 50 },
  { id: 6, category: 'Cardiovascular & Metabolic', label: 'Hypertension', sortOrder: 60 },
  { id: 7, category: 'Cardiovascular & Metabolic', label: 'Diabetes', sortOrder: 70 },
  { id: 8, category: 'Respiratory', label: 'Asthma', sortOrder: 80 },
  { id: 9, category: 'Respiratory', label: 'Breathing difficulty', sortOrder: 90 },
  { id: 10, category: 'Other', label: 'Recent injury', sortOrder: 100 },
];

const profileGoalRows = ['Stay Active', 'Build Strength', 'Improve Flexibility'];

const profileMenuRows: ProfileMenuItem[] = [
  { id: 1, icon: 'settings', label: 'Account Settings', color: '#14B8A6', actionKey: 'settings' },
  { id: 2, icon: 'bell', label: 'Notifications', color: '#14B8A6', actionKey: 'notifications' },
  { id: 3, icon: 'help-circle', label: 'Help & Support', color: '#14B8A6', actionKey: 'support' },
  { id: 4, icon: 'shield', label: 'Privacy Settings', color: '#14B8A6', actionKey: 'privacy' },
  { id: 5, icon: 'log-out', label: 'Log Out', color: '#EF4444', actionKey: 'logout' },
];

const categoryById = new Map(workoutCategoryRows.map((category) => [category.id, category]));

const toWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  title: row.title,
  duration: `${row.durationMinutes} min`,
  difficulty: row.difficulty,
  calories: `${row.calories} cal`,
  category: categoryById.get(row.categoryId)?.name ?? 'Beginner',
  emoji: row.emoji,
  gradient: [row.gradientStart, row.gradientEnd],
  description: row.description,
  intensity: row.intensity,
});

const sortByOrder = <T extends { sortOrder?: number }>(items: T[]) =>
  [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

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
  if (profile.age >= 55 && row.recommendedMinAge) {
    score += 5;
  }
  if (profile.age < 55 && row.recommendedMaxAge) {
    score += 2;
  }
  return score;
};

export const db = {
  async getWorkoutCategories() {
    return ['All', ...sortByOrder(workoutCategoryRows).map((category) => category.name)];
  },

  async getWorkouts() {
    return workoutRows.map(toWorkout);
  },

  async getRecommendedWorkout(profile: UserProfile | null) {
    const [first] = [...workoutRows].sort(
      (a, b) => rankWorkoutForProfile(profile)(b) - rankWorkoutForProfile(profile)(a),
    );
    return toWorkout(first);
  },

  async getWorkoutExercises(workoutId?: number) {
    const selectedWorkoutId = workoutId ?? 4;
    const exercises = workoutExerciseRows.filter((exercise) => exercise.workoutId === selectedWorkoutId);
    return sortByOrder(exercises.length ? exercises : workoutExerciseRows.filter((exercise) => exercise.workoutId === 4));
  },

  async getRewardVouchers() {
    return voucherRows;
  },

  async getAchievements(stats: UserStats) {
    return achievementRows.map((achievement) => ({
      ...achievement,
      unlocked: stats[achievement.requirementType] >= achievement.requirementValue,
    }));
  },

  async getOnboardingChoices(): Promise<OnboardingChoices> {
    return {
      fitnessLevels: sortByOrder(onboardingChoiceRows.filter((choice) => choice.fieldName === 'fitness_level')).map((choice) => choice.label),
      intensityLevels: sortByOrder(onboardingChoiceRows.filter((choice) => choice.fieldName === 'preferred_intensity')).map((choice) => choice.label),
      medicalConditionOptions: sortByOrder(medicalConditionRows).map(({ sortOrder, ...option }) => option),
    };
  },

  async getProfileGoals() {
    return profileGoalRows;
  },

  async getProfileMenuItems() {
    return profileMenuRows;
  },
};
