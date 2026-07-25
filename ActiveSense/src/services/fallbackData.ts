import {
  Achievement,
  MedicalConditionOption,
  OnboardingChoices,
  PoseTrainingSample,
  RewardVoucher,
  Workout,
  WorkoutExercise,
} from '../types';

// These rows mirror db/seed.sql so local builds can run before Supabase is configured.
export const fallbackWorkoutCategories = ['All', 'Strength', 'Healthy Ageing', 'Mobility'];

// The catalog fallback keeps every workout screen navigable during local simulator testing.
export const fallbackWorkouts: Workout[] = [
  {
    id: 1,
    title: 'Strength Form Basics',
    duration: '15 min',
    difficulty: 'Beginner',
    calories: '105 cal',
    category: 'Strength',
    emoji: 'activity',
    gradient: ['#14B8A6', '#2563EB'],
    description: 'Camera-tracked squats, sit-to-stands, and calf raises focused on visible lower-body form.',
    intensity: 'Low',
  },
  {
    id: 2,
    title: 'Healthy Ageing Balance & Strength',
    duration: '22 min',
    difficulty: 'Low Impact',
    calories: '100 cal',
    category: 'Healthy Ageing',
    emoji: 'heart',
    gradient: ['#0F766E', '#84CC16'],
    description: 'Gentle camera-tracked functional strength and balance exercises for active ageing.',
    intensity: 'Low',
  },
  {
    id: 3,
    title: 'Mobility & Flexibility',
    duration: '12 min',
    difficulty: 'Beginner',
    calories: '55 cal',
    category: 'Mobility',
    emoji: 'repeat',
    gradient: ['#06B6D4', '#8B5CF6'],
    description: 'Low-impact upper-body and trunk mobility movements tracked with visible posture cues.',
    intensity: 'Low',
  },
];

// Workout exercises are grouped by workout id for the quick-start and detail flows.
export const fallbackWorkoutExercises: WorkoutExercise[] = [
  { id: 1, workoutId: 1, name: 'Squats', sets: 3, reps: 10, points: 50, sortOrder: 10, targetLandmarks: 33, poseClass: 'squat', feedbackPrompt: 'Keep knees aligned with toes and chest lifted.' },
  { id: 2, workoutId: 1, name: 'Sit to Stand', sets: 3, reps: 10, points: 40, sortOrder: 20, targetLandmarks: 33, poseClass: 'sit_to_stand', feedbackPrompt: 'Lean forward slightly, stand tall, then lower with control.' },
  { id: 3, workoutId: 1, name: 'Calf Raises', sets: 3, reps: 12, points: 35, sortOrder: 30, targetLandmarks: 33, poseClass: 'calf_raise', feedbackPrompt: 'Rise onto your toes, pause briefly, then lower with control.' },
  { id: 4, workoutId: 2, name: 'Stationary March', sets: 2, reps: 20, points: 30, sortOrder: 10, targetLandmarks: 33, poseClass: 'march', feedbackPrompt: 'Stand tall and lift each knee gently.' },
  { id: 5, workoutId: 2, name: 'Side Leg Raise', sets: 2, reps: 10, points: 35, sortOrder: 20, targetLandmarks: 33, poseClass: 'side_leg_raise', feedbackPrompt: 'Keep your body tall and lift one straight leg to the side.' },
  { id: 6, workoutId: 2, name: 'Single Leg Stand', sets: 2, reps: 5, points: 35, sortOrder: 30, targetLandmarks: 33, poseClass: 'single_leg_stand', feedbackPrompt: 'Stand tall and lift one foot while keeping your balance.' },
  { id: 7, workoutId: 2, name: 'Sit to Stand', sets: 2, reps: 10, points: 35, sortOrder: 40, targetLandmarks: 33, poseClass: 'sit_to_stand', feedbackPrompt: 'Use a steady chair, stand tall, then sit back down slowly.' },
  { id: 8, workoutId: 2, name: 'Calf Raises', sets: 2, reps: 12, points: 30, sortOrder: 50, targetLandmarks: 33, poseClass: 'calf_raise', feedbackPrompt: 'Rise onto your toes while keeping posture upright.' },
  { id: 9, workoutId: 3, name: 'Overhead Reach', sets: 2, reps: 10, points: 25, sortOrder: 10, targetLandmarks: 33, poseClass: 'overhead_reach', feedbackPrompt: 'Reach one or both arms overhead, then lower smoothly.' },
  { id: 10, workoutId: 3, name: 'Side Bend', sets: 2, reps: 10, points: 25, sortOrder: 20, targetLandmarks: 33, poseClass: 'side_bend', feedbackPrompt: 'Bend gently to one side, return upright, then switch sides.' },
  { id: 11, workoutId: 3, name: 'Torso Twist', sets: 2, reps: 10, points: 25, sortOrder: 30, targetLandmarks: 33, poseClass: 'torso_twist', feedbackPrompt: 'Rotate your shoulders gently while keeping hips steady.' },
];

// Classifier fallback samples are the same ten-feature vectors expected by poseClassifier.
export const fallbackPoseTrainingSamples: PoseTrainingSample[] = [
  { id: 1, label: 'squat', features: [166, 165, 82, 84, 72, 74, 65, 1.12, 0.3, 0.55] },
  { id: 2, label: 'squat', features: [158, 160, 96, 93, 83, 82, 68, 1.2, 0.28, 0.48] },
  { id: 3, label: 'sit_to_stand', features: [168, 168, 96, 98, 78, 80, 72, 1.12, 0.72, 0.5] },
  { id: 4, label: 'sit_to_stand', features: [166, 166, 128, 126, 112, 114, 76, 1.16, 0.62, 0.52] },
  { id: 5, label: 'calf_raise', features: [168, 168, 168, 168, 166, 166, 88, 1.25, 0.52, 0.55] },
  { id: 6, label: 'calf_raise', features: [166, 166, 170, 170, 168, 168, 88, 1.28, 0.5, 0.5] },
  { id: 7, label: 'side_leg_raise', features: [168, 168, 170, 156, 170, 142, 88, 1.38, 0.48, 2.45] },
  { id: 8, label: 'side_leg_raise', features: [168, 168, 156, 170, 142, 170, 88, 1.36, 0.48, 2.35] },
  { id: 9, label: 'single_leg_stand', features: [166, 166, 92, 168, 90, 168, 88, 1.25, 0.5, 1.3] },
  { id: 10, label: 'single_leg_stand', features: [166, 166, 168, 92, 168, 90, 88, 1.25, 0.5, 1.3] },
  { id: 11, label: 'march', features: [150, 150, 88, 166, 92, 164, 86, 1.2, 0.85, 1.45] },
  { id: 12, label: 'march', features: [150, 150, 166, 88, 164, 92, 86, 1.2, 0.85, 1.45] },
  { id: 13, label: 'overhead_reach', features: [168, 168, 168, 168, 168, 168, 88, 1.32, 1.75, 0.55] },
  { id: 14, label: 'side_bend', features: [168, 168, 168, 168, 168, 168, 76, 1.3, 0.7, 0.55] },
  { id: 15, label: 'torso_twist', features: [168, 168, 168, 168, 168, 168, 88, 1.55, 0.65, 0.55] },
];

export const fallbackRewardVouchers: RewardVoucher[] = [
  { id: 1, name: 'FairPrice $5 Voucher', points: 500, emoji: '🛒', category: 'Groceries' },
  { id: 2, name: 'GrabFood $10 Voucher', points: 1000, emoji: '🍔', category: 'Food' },
  { id: 3, name: 'Guardian $5 Voucher', points: 500, emoji: '💊', category: 'Health' },
  { id: 4, name: 'Decathlon $15 Voucher', points: 1500, emoji: '⚽', category: 'Sports' },
];

export const fallbackAchievements: Achievement[] = [
  { id: 1, title: '7-Day Streak', emoji: '🔥', desc: 'Complete 7 days in a row', requirementType: 'streakDays', requirementValue: 7 },
  { id: 2, title: 'First Workout', emoji: '🎯', desc: 'Finish your first session', requirementType: 'totalWorkouts', requirementValue: 1 },
  { id: 3, title: '1000 Points', emoji: '💯', desc: 'Earn 1000 lifetime Healthpoints', requirementType: 'lifetimeHealthpoints', requirementValue: 1000 },
  { id: 4, title: '30-Day Streak', emoji: '🏆', desc: 'Complete 30 consecutive days', requirementType: 'streakDays', requirementValue: 30 },
];

export const fallbackMedicalConditionOptions: MedicalConditionOption[] = [
  { id: 1, category: 'General', label: 'None' },
  { id: 2, category: 'Mobility & Joint', label: 'Knee pain' },
  { id: 3, category: 'Mobility & Joint', label: 'Back pain' },
  { id: 4, category: 'Mobility & Joint', label: 'Arthritis' },
  { id: 5, category: 'Mobility & Joint', label: 'Balance concerns' },
  { id: 6, category: 'Cardiovascular & Metabolic', label: 'Hypertension' },
  { id: 7, category: 'Cardiovascular & Metabolic', label: 'Diabetes' },
  { id: 8, category: 'Respiratory', label: 'Asthma' },
  { id: 9, category: 'Respiratory', label: 'Breathing difficulty' },
  { id: 10, category: 'Other', label: 'Recent injury' },
];

export const fallbackOnboardingChoices: OnboardingChoices = {
  fitnessLevels: ['Beginner', 'Intermediate', 'Advanced', 'Low Impact'],
  intensityLevels: ['Low', 'Medium', 'High'],
  medicalConditionOptions: fallbackMedicalConditionOptions,
};

export const fallbackProfileGoals = ['Build Strength', 'Improve Form', 'Improve Balance', 'Age Actively'];

export const fallbackDashboardSettings = { goalLabel: '30 min' };
export const fallbackDefaultWorkoutId = 1;
