type ExerciseScoreInput = {
  basePoints: number;
  reps: number;
  targetReps: number;
  elapsedMs?: number;
};

export const calculateExerciseScore = ({
  basePoints,
  reps,
  targetReps,
  elapsedMs = 0,
}: ExerciseScoreInput) => {
  // Skipped exercises earn only the completed share of their configured points.
  const completionRatio = targetReps > 0 ? Math.min(1, reps / targetReps) : 0;
  const expectedSeconds = reps * 2;
  const elapsedSeconds = elapsedMs / 1000;
  const isRushed = reps > 0 && elapsedSeconds > 0 && elapsedSeconds < expectedSeconds;
  const rawPoints = Math.floor(basePoints * completionRatio);

  return {
    completionRatio,
    isRushed,
    points: isRushed ? Math.floor(rawPoints * 0.5) : rawPoints,
  };
};
