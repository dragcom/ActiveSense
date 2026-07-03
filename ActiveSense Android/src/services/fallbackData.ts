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
export const fallbackWorkoutCategories = ['All', 'Beginner', 'Senior', 'Cardio', 'Strength', 'Flexibility'];

// The catalog fallback keeps every workout screen navigable during local simulator testing.
export const fallbackWorkouts: Workout[] = [
  {
    id: 1,
    title: 'Gentle Morning Yoga',
    duration: '15 min',
    difficulty: 'Beginner',
    calories: '50 cal',
    category: 'Flexibility',
    emoji: '🧘',
    gradient: ['#A78BFA', '#EC4899'],
    description: 'Start your day with gentle stretches and mindful breathing.',
    intensity: 'Low',
  },
  {
    id: 2,
    title: 'Senior Seated Exercises',
    duration: '20 min',
    difficulty: 'Low Impact',
    calories: '60 cal',
    category: 'Senior',
    emoji: '🪑',
    gradient: ['#14B8A6', '#06B6D4'],
    description: 'Safe, effective chair-based movements for mobility.',
    intensity: 'Low',
  },
  {
    id: 3,
    title: 'Cardio Walk Burst',
    duration: '18 min',
    difficulty: 'Moderate',
    calories: '120 cal',
    category: 'Cardio',
    emoji: '🚶',
    gradient: ['#2DD4BF', '#22D3EE'],
    description: 'Light cardio intervals to boost endurance and mood.',
    intensity: 'Medium',
  },
  {
    id: 4,
    title: 'Core Stability Basics',
    duration: '16 min',
    difficulty: 'Beginner',
    calories: '90 cal',
    category: 'Strength',
    emoji: '🧠',
    gradient: ['#FB923C', '#F43F5E'],
    description: 'Build a strong core with low-impact strength work.',
    intensity: 'Low',
  },
  {
    id: 5,
    title: 'Balance & Mobility',
    duration: '12 min',
    difficulty: 'Low Impact',
    calories: '45 cal',
    category: 'Senior',
    emoji: '⚖️',
    gradient: ['#60A5FA', '#38BDF8'],
    description: 'Improve balance with steady, confidence-building drills.',
    intensity: 'Low',
  },
  {
    id: 6,
    title: 'Low Impact HIIT',
    duration: '14 min',
    difficulty: 'Intermediate',
    calories: '140 cal',
    category: 'Cardio',
    emoji: '⚡',
    gradient: ['#F97316', '#EF4444'],
    description: 'Short bursts of energy without the joint strain.',
    intensity: 'High',
  },
  {
    id: 7,
    title: 'Resistance Band Flow',
    duration: '22 min',
    difficulty: 'Intermediate',
    calories: '160 cal',
    category: 'Strength',
    emoji: '🎯',
    gradient: ['#34D399', '#10B981'],
    description: 'Strengthen major muscle groups with gentle resistance.',
    intensity: 'Medium',
  },
  {
    id: 8,
    title: 'Evening Stretch Reset',
    duration: '10 min',
    difficulty: 'Beginner',
    calories: '35 cal',
    category: 'Flexibility',
    emoji: '🌙',
    gradient: ['#A78BFA', '#818CF8'],
    description: 'Wind down with soothing stretches and breath work.',
    intensity: 'Low',
  },
];

// Workout exercises are grouped by workout id for the quick-start and detail flows.
export const fallbackWorkoutExercises: WorkoutExercise[] = [
  { id: 1, workoutId: 1, name: 'Breathing Reset', sets: 1, reps: 5, points: 20, sortOrder: 10, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Relax your shoulders and keep breathing steadily.' },
  { id: 2, workoutId: 1, name: 'Standing Forward Fold', sets: 2, reps: 6, points: 35, sortOrder: 20, targetLandmarks: 33, poseClass: 'stretch', feedbackPrompt: 'Hinge gently and keep your knees soft.' },
  { id: 3, workoutId: 1, name: 'Seated Twist', sets: 2, reps: 8, points: 35, sortOrder: 30, targetLandmarks: 33, poseClass: 'seated', feedbackPrompt: 'Rotate slowly and keep your spine tall.' },
  { id: 4, workoutId: 2, name: 'Seated Marches', sets: 3, reps: 10, points: 45, sortOrder: 10, targetLandmarks: 33, poseClass: 'seated', feedbackPrompt: 'Lift one knee at a time and sit tall.' },
  { id: 5, workoutId: 2, name: 'Chair Arm Raises', sets: 2, reps: 12, points: 35, sortOrder: 20, targetLandmarks: 33, poseClass: 'arm-raise', feedbackPrompt: 'Keep your shoulders relaxed as your arms rise.' },
  { id: 6, workoutId: 2, name: 'Ankle Circles', sets: 2, reps: 10, points: 20, sortOrder: 30, targetLandmarks: 33, poseClass: 'seated', feedbackPrompt: 'Move smoothly and avoid locking your knees.' },
  { id: 7, workoutId: 3, name: 'Walk In Place', sets: 3, reps: 20, points: 50, sortOrder: 10, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Land softly and keep your chest open.' },
  { id: 8, workoutId: 3, name: 'Side Steps', sets: 3, reps: 12, points: 45, sortOrder: 20, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Step wide enough to feel balanced.' },
  { id: 9, workoutId: 3, name: 'Heel Digs', sets: 2, reps: 16, points: 35, sortOrder: 30, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Point your toes upward and move with control.' },
  { id: 10, workoutId: 4, name: 'Squats', sets: 3, reps: 10, points: 50, sortOrder: 10, targetLandmarks: 33, poseClass: 'squat', feedbackPrompt: 'Keep knees aligned with toes.' },
  { id: 11, workoutId: 4, name: 'Wall Push-ups', sets: 3, reps: 8, points: 40, sortOrder: 20, targetLandmarks: 33, poseClass: 'pushup', feedbackPrompt: 'Keep your body long from shoulders to heels.' },
  { id: 12, workoutId: 4, name: 'Arm Circles', sets: 2, reps: 15, points: 30, sortOrder: 30, targetLandmarks: 33, poseClass: 'arm-raise', feedbackPrompt: 'Small controlled circles, shoulders down.' },
  { id: 13, workoutId: 4, name: 'Leg Raises', sets: 3, reps: 10, points: 50, sortOrder: 40, targetLandmarks: 33, poseClass: 'side-leg-lift', feedbackPrompt: 'Brace your core before lifting.' },
  { id: 14, workoutId: 4, name: 'Cool Down Stretch', sets: 1, reps: 1, points: 30, sortOrder: 50, targetLandmarks: 33, poseClass: 'stretch', feedbackPrompt: 'Slow your breathing and ease into the stretch.' },
  { id: 15, workoutId: 5, name: 'Tandem Stand', sets: 3, reps: 8, points: 35, sortOrder: 10, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Use a wall or chair nearby for confidence.' },
  { id: 16, workoutId: 5, name: 'Side Leg Lifts', sets: 2, reps: 10, points: 35, sortOrder: 20, targetLandmarks: 33, poseClass: 'side-leg-lift', feedbackPrompt: 'Lift only as high as you can stay stable.' },
  { id: 17, workoutId: 5, name: 'Heel-to-Toe Walk', sets: 2, reps: 12, points: 30, sortOrder: 30, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Move slowly and keep your gaze forward.' },
  { id: 18, workoutId: 6, name: 'Low Jacks', sets: 3, reps: 12, points: 50, sortOrder: 10, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Step out instead of jumping.' },
  { id: 19, workoutId: 6, name: 'Fast Marches', sets: 3, reps: 18, points: 55, sortOrder: 20, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Drive your arms and stay light on your feet.' },
  { id: 20, workoutId: 6, name: 'Squat Reach', sets: 2, reps: 10, points: 35, sortOrder: 30, targetLandmarks: 33, poseClass: 'squat', feedbackPrompt: 'Reach tall after each controlled squat.' },
  { id: 21, workoutId: 7, name: 'Band Rows', sets: 3, reps: 12, points: 55, sortOrder: 10, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Pull elbows back without shrugging.' },
  { id: 22, workoutId: 7, name: 'Band Press', sets: 3, reps: 10, points: 50, sortOrder: 20, targetLandmarks: 33, poseClass: 'arm-raise', feedbackPrompt: 'Press forward with steady wrists.' },
  { id: 23, workoutId: 7, name: 'Band Good Morning', sets: 2, reps: 10, points: 45, sortOrder: 30, targetLandmarks: 33, poseClass: 'stretch', feedbackPrompt: 'Hinge at the hips and keep your back neutral.' },
  { id: 24, workoutId: 8, name: 'Neck Release', sets: 1, reps: 6, points: 15, sortOrder: 10, targetLandmarks: 33, poseClass: 'standing', feedbackPrompt: 'Move slowly and avoid forcing range.' },
  { id: 25, workoutId: 8, name: 'Hamstring Stretch', sets: 2, reps: 6, points: 20, sortOrder: 20, targetLandmarks: 33, poseClass: 'stretch', feedbackPrompt: 'Keep the stretch gentle and even.' },
  { id: 26, workoutId: 8, name: 'Child Pose Breathing', sets: 1, reps: 5, points: 20, sortOrder: 30, targetLandmarks: 33, poseClass: 'stretch', feedbackPrompt: 'Let each breath soften your back.' },
];

// Classifier fallback samples are the same ten-feature vectors expected by poseClassifier.
export const fallbackPoseTrainingSamples: PoseTrainingSample[] = [
  { id: 1, label: 'standing', features: [174, 174, 176, 176, 170, 170, 84, 1.75, 0.26, 0.22] },
  { id: 2, label: 'standing', features: [168, 170, 172, 174, 165, 166, 88, 1.65, 0.31, 0.28] },
  { id: 3, label: 'seated', features: [145, 148, 91, 94, 86, 89, 82, 1.05, 0.24, 0.58] },
  { id: 4, label: 'seated', features: [132, 136, 104, 108, 91, 95, 77, 0.98, 0.33, 0.62] },
  { id: 5, label: 'squat', features: [166, 165, 82, 84, 72, 74, 65, 1.12, 0.3, 0.55] },
  { id: 6, label: 'squat', features: [158, 160, 96, 93, 83, 82, 68, 1.2, 0.28, 0.48] },
  { id: 7, label: 'pushup', features: [105, 108, 162, 160, 174, 172, 20, 0.38, 0.62, 0.26] },
  { id: 8, label: 'pushup', features: [82, 86, 166, 164, 172, 173, 16, 0.34, 0.7, 0.25] },
  { id: 9, label: 'situp', features: [152, 150, 94, 96, 95, 98, 32, 0.72, 0.45, 0.52] },
  { id: 10, label: 'situp', features: [165, 166, 78, 80, 82, 84, 24, 0.65, 0.48, 0.58] },
  { id: 11, label: 'arm-raise', features: [166, 168, 172, 174, 166, 168, 84, 1.68, 0.78, 0.24] },
  { id: 12, label: 'arm-raise', features: [112, 118, 170, 172, 164, 166, 80, 1.58, 0.72, 0.27] },
  { id: 13, label: 'side-leg-lift', features: [168, 170, 112, 170, 94, 166, 70, 1.45, 0.34, 0.72] },
  { id: 14, label: 'side-leg-lift', features: [170, 168, 170, 116, 166, 96, 70, 1.45, 0.34, 0.72] },
  { id: 15, label: 'stretch', features: [172, 172, 158, 160, 82, 84, 42, 1.02, 0.4, 0.46] },
  { id: 16, label: 'stretch', features: [160, 158, 150, 148, 72, 74, 35, 0.92, 0.44, 0.5] },
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

export const fallbackProfileGoals = ['Stay Active', 'Build Strength', 'Improve Flexibility'];

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
export const fallbackDefaultWorkoutId = 4;
