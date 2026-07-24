import {
  Achievement,
  MedicalConditionOption,
  OnboardingChoices,
  PoseTrainingSample,
  ProfileMenuItem,
  RewardVoucher,
  Workout,
  WorkoutExercise,
} from '../types';

// These rows mirror db/seed.sql so iOS can still run before Supabase is configured.
export const fallbackWorkoutCategories = ['All', 'Strength'];

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
    description: 'Camera-tracked squats, push-ups, and lunges focused on visible, coachable strength form.',
    intensity: 'Low',
  },
];

// Workout exercises are grouped by workout id for the quick-start and detail flows.
export const fallbackWorkoutExercises: WorkoutExercise[] = [
  { id: 1, workoutId: 1, name: 'Squats', sets: 3, reps: 10, points: 50, sortOrder: 10, targetLandmarks: 33, poseClass: 'squat', feedbackPrompt: 'Keep knees aligned with toes and chest lifted.' },
  { id: 2, workoutId: 1, name: 'Push-ups', sets: 3, reps: 8, points: 50, sortOrder: 20, targetLandmarks: 33, poseClass: 'pushup', feedbackPrompt: 'Keep shoulders, hips, and heels in one strong line.' },
  { id: 3, workoutId: 1, name: 'Lunges', sets: 3, reps: 8, points: 50, sortOrder: 30, targetLandmarks: 33, poseClass: 'lunge', feedbackPrompt: 'Step into a split stance, keep your chest tall, then drive back up.' },
];

// Classifier fallback samples are the same ten-feature vectors expected by poseClassifier.
export const fallbackPoseTrainingSamples: PoseTrainingSample[] = [
  { id: 1, label: 'squat', features: [166, 165, 82, 84, 72, 74, 65, 1.12, 0.3, 0.55] },
  { id: 2, label: 'squat', features: [158, 160, 96, 93, 83, 82, 68, 1.2, 0.28, 0.48] },
  { id: 3, label: 'pushup', features: [105, 108, 162, 160, 174, 172, 20, 0.38, 0.62, 0.26] },
  { id: 4, label: 'pushup', features: [82, 86, 166, 164, 172, 173, 16, 0.34, 0.7, 0.25] },
  { id: 5, label: 'lunge', features: [164, 162, 92, 128, 102, 118, 78, 1.65, 1.02, 2.2] },
  { id: 6, label: 'lunge', features: [166, 164, 118, 88, 116, 98, 82, 1.58, 1.04, 2.05] },
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
  { id: 3, title: '1000 Points', emoji: '💯', desc: 'Earn 1000 Healthpoints', requirementType: 'healthpoints', requirementValue: 1000 },
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

export const fallbackProfileGoals = ['Build Strength', 'Improve Form'];

export const fallbackProfileMenuItems: ProfileMenuItem[] = [
  { id: 1, icon: 'settings', label: 'Account Settings', actionKey: 'settings', color: '#14B8A6' },
  { id: 2, icon: 'bell', label: 'Notifications', badge: '3', actionKey: 'notifications', color: '#14B8A6' },
  { id: 3, icon: 'help-circle', label: 'Help & Support', actionKey: 'support', color: '#14B8A6' },
  { id: 4, icon: 'shield', label: 'Privacy Settings', actionKey: 'privacy', color: '#14B8A6' },
  { id: 5, icon: 'log-out', label: 'Log Out', actionKey: 'logout', color: '#EF4444' },
];

// Profile links use the same keys as profile_menu_items and bottom legal links.
export const fallbackInfoPages: Record<string, { title: string; icon: string; body: string }> = {
  settings: {
    title: 'Account Settings',
    icon: 'settings',
    body: 'Supabase Auth will manage email, password, and account security here. Local prototype data is stored on this device when Supabase Auth is not configured.',
  },
  notifications: {
    title: 'Notifications',
    icon: 'bell',
    body: 'Workout reminders, streak prompts, and reward updates will be configured here. Notification preferences will become database-backed user settings.',
  },
  support: {
    title: 'Help & Support',
    icon: 'help-circle',
    body: 'Support content explains how ActiveSense uses local pose estimation, Healthpoints, and tailored workouts. A future support center can connect FAQs and contact forms.',
  },
  privacy: {
    title: 'Privacy Settings',
    icon: 'shield',
    body: 'ActiveSense processes camera frames locally for pose landmarks. Raw workout video is not uploaded in this prototype; Supabase should store profile, workout, reward, and landmark summary metadata only.',
  },
  profile_photo: {
    title: 'Profile Photo',
    icon: 'camera',
    body: 'Profile photo upload will connect to Supabase Storage. The workout camera remains separate and is used for local pose landmarks.',
  },
  terms: {
    title: 'Terms',
    icon: 'file-text',
    body: 'Prototype terms: ActiveSense is an educational NUS Orbital prototype and should not replace professional medical advice. Stop exercising if you feel pain, dizziness, or discomfort.',
  },
  contact: {
    title: 'Contact',
    icon: 'mail',
    body: 'Contact and feedback forms will be connected when backend messaging is added. For now, this page confirms the link is wired.',
  },
};

export const fallbackDashboardSettings = { goalLabel: '30 min' };
export const fallbackDefaultWorkoutId = 1;
