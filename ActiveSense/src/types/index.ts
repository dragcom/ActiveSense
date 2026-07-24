// Shared app types describe the data shape moving between screens and services.
export type UserProfile = {
  name: string;
  age: number;
  fitnessLevel: string;
  medicalConditions: string[];
  preferredIntensity: string;
  createdAt?: string;
  privacyMode?: 'Avatar' | 'Camera';
  avatar?: AvatarProfileConfig;
};

// AvatarProfileConfig stores the user's single presentation avatar.
export type AvatarProfileConfig = {
  optionId: string;
  label: string;
  avatarUrl: string;
  accentColor: string;
  sourceAvatarUrl?: string;
  localAvatarUri?: string;
  cachedAt?: string;
  skinColor?: string;
  head?: string;
  hair?: string;
  faceMarks?: string;
  emote?: string;
};

// UserStats tracks the simple progress counters shown throughout the app.
export type UserStats = {
  healthpoints: number;
  streakDays: number;
  totalWorkouts: number;
};

// Workout is the card-friendly shape used by Home and Workouts screens.
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

// WorkoutExercise is the per-session plan used by the camera workout flow.
export type WorkoutExercise = {
  id: number;
  workoutId: number;
  name: string;
  sets: number;
  reps: number;
  points: number;
  sortOrder: number;
  targetLandmarks: number;
  poseClass: PoseClassLabel;
  feedbackPrompt: string;
};

// PoseLandmark mirrors one MediaPipe body point from web or native camera tracking.
export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

// PoseClassLabel names the exercise forms that the lightweight classifier can detect.
export type PoseClassLabel =
  | 'squat'
  | 'pushup'
  | 'lunge';

// PoseTrainingSample stores precomputed features for one known exercise pose.
export type PoseTrainingSample = {
  id: number;
  label: PoseClassLabel;
  features: number[];
};

// PoseClassification is the classifier's best guess for the current body pose.
export type PoseClassification = {
  label: PoseClassLabel;
  confidence: number;
  distance: number;
};

// WeeklyActivity powers the compact bar charts on Home and Progress.
export type WeeklyActivity = {
  id: string;
  day: string;
  points: number;
};

// RewardVoucher describes a redeemable item in the Healthpoints shop.
export type RewardVoucher = {
  id: number;
  name: string;
  points: number;
  emoji: string;
  category: string;
};

// Achievement describes a progress milestone before the UI adds unlocked state.
export type Achievement = {
  id: number;
  title: string;
  emoji: string;
  desc: string;
  requirementType: keyof UserStats;
  requirementValue: number;
};

// OnboardingChoices fills the profile setup pickers from one service call.
export type OnboardingChoices = {
  fitnessLevels: string[];
  intensityLevels: string[];
  medicalConditionOptions: MedicalConditionOption[];
};

// MedicalConditionOption lets onboarding group health constraints by category.
export type MedicalConditionOption = {
  id: number;
  category: string;
  label: string;
};

// ProfileMenuItem keeps the Profile screen's menu rows data-driven.
export type ProfileMenuItem = {
  id: number;
  icon: string;
  label: string;
  badge?: string;
  actionKey?: 'settings' | 'notifications' | 'support' | 'privacy' | 'logout';
  color: string;
};

// WorkoutSession is the local history entry saved when a workout finishes.
export type WorkoutSession = {
  id: string;
  workoutId?: number;
  pointsEarned: number;
  completedAt: string;
  poseLandmarkCount?: number;
  processedLocally: boolean;
};
