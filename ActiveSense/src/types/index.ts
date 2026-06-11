export type UserProfile = {
  name: string;
  age: number;
  fitnessLevel: string;
  medicalConditions: string[];
  preferredIntensity: string;
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
  gradient: string[];
  description: string;
};
