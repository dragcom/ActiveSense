export type UserProfile = {
  name: string;
  age: number;
  fitnessLevel: string;
  medicalConditions: string[];
  preferredIntensity: string;
  createdAt?: string;
  privacyMode?: 'Avatar' | 'Camera';
  avatar?: Record<string, any>;
};

export type UserStats = {
  healthpoints: number;
  streakDays: number;
  totalWorkouts: number;
};

export type Workout = {
  id: number;
  title: string;
  duration: string;
  difficulty: string;
  calories: string;
  category: string;
  emoji: string;
  gradient: [string, string];
  description: string;
  intensity: string;
};

export type WorkoutExercise = {
  id: number;
  workoutId: number;
  name: string;
  sets: number;
  reps: number;
  points: number;
  sortOrder: number;
  targetLandmarks: number;
  feedbackPrompt: string;
};

export type WeeklyActivity = {
  id: string;
  day: string;
  points: number;
};

export type RewardVoucher = {
  id: number;
  name: string;
  points: number;
  emoji: string;
  category: string;
};

export type Achievement = {
  id: number;
  title: string;
  emoji: string;
  desc: string;
  requirementType: keyof UserStats;
  requirementValue: number;
};

export type OnboardingChoices = {
  fitnessLevels: string[];
  intensityLevels: string[];
  medicalConditionOptions: MedicalConditionOption[];
};

export type MedicalConditionOption = {
  id: number;
  category: string;
  label: string;
};

export type ProfileMenuItem = {
  id: number;
  icon: string;
  label: string;
  badge?: string;
  actionKey?: 'settings' | 'notifications' | 'support' | 'privacy' | 'logout';
  color: string;
};

export type WorkoutSession = {
  id: string;
  workoutId?: number;
  pointsEarned: number;
  completedAt: string;
  poseLandmarkCount?: number;
  processedLocally: boolean;
};
