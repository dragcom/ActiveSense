// These route types keep navigation calls safe across the whole app.
export type RootStackParamList = {
  AuthLanding: undefined;
  Login: undefined;
  Onboarding: { mode?: 'signup' | 'edit' } | undefined;
  InfoPage: { title: string; body: string; icon?: string };
  Main: undefined;
  WorkoutSession: { workoutId?: number } | undefined;
};

// The bottom tabs live inside the root stack's Main screen.
export type MainTabParamList = {
  Home: undefined;
  Workouts: undefined;
  Progress: undefined;
  Profile: undefined;
};
