export type RootStackParamList = {
  AuthLanding: undefined;
  Login: undefined;
  Onboarding: { mode?: 'signup' | 'edit' } | undefined;
  InfoPage: { title: string; body: string; icon?: string };
  Main: undefined;
  WorkoutSession: { workoutId?: number } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Workouts: undefined;
  Progress: undefined;
  Profile: undefined;
};
