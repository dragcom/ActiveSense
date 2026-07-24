import { PostureResult } from './postureRules';

export type WorkoutPoseCounterState = {
  movementPhase: 'ready' | 'down';
  classifierArmed: boolean;
  lastRepAt: number;
  staticHoldStartedAt: number | null;
};

type PoseCounterInput = {
  posture?: PostureResult | null;
  isExpectedPose?: boolean;
  currentReps: number;
  targetReps: number;
  now?: number;
};

export const createWorkoutPoseCounterState = (): WorkoutPoseCounterState => ({
  movementPhase: 'ready',
  classifierArmed: true,
  lastRepAt: 0,
  staticHoldStartedAt: null,
});

export const resetWorkoutPoseCounter = (state: WorkoutPoseCounterState) => {
  state.movementPhase = 'ready';
  state.classifierArmed = true;
  state.lastRepAt = 0;
  state.staticHoldStartedAt = null;
};

export const addManualWorkoutRep = (currentReps: number, targetReps: number) =>
  Math.min(targetReps, currentReps + 1);

const countPoseFrame = (currentReps: number, targetReps: number, now: number) => {
  const next = Math.min(targetReps, currentReps + 1);
  const counted = next !== currentReps;
  return { nextReps: next, counted, countedAt: now };
};

export const countWorkoutPoseFrame = (
  state: WorkoutPoseCounterState,
  {
    posture,
    isExpectedPose,
    currentReps,
    targetReps,
    now = Date.now(),
  }: PoseCounterInput,
) => {
  if (currentReps >= targetReps) {
    return { nextReps: currentReps, counted: false };
  }

  if (posture?.isStatic) {
    // Holds count only after the posture stays stable, then advance at a steady cadence.
    const stableHold = posture.confidence >= 0.78 && !posture.warning;
    if (!stableHold) {
      state.staticHoldStartedAt = null;
      return { nextReps: currentReps, counted: false };
    }

    state.staticHoldStartedAt ??= now;
    if (now - state.staticHoldStartedAt >= 1800 && now - state.lastRepAt >= 1800) {
      const counted = countPoseFrame(currentReps, targetReps, now);
      state.lastRepAt = now;
      state.staticHoldStartedAt = now;
      return counted;
    }
    return { nextReps: currentReps, counted: false };
  }

  state.staticHoldStartedAt = null;

  if (posture) {
    // Dynamic exercises complete one rep only after moving down and returning to the top.
    if (posture.position === 'bottom') {
      state.movementPhase = 'down';
      return { nextReps: currentReps, counted: false };
    }

    if (
      posture.position === 'top' &&
      state.movementPhase === 'down' &&
      now - state.lastRepAt >= 900
    ) {
      state.movementPhase = 'ready';
      state.lastRepAt = now;
      return countPoseFrame(currentReps, targetReps, now);
    }
  }

  if (isExpectedPose === false) {
    state.classifierArmed = true;
    return { nextReps: currentReps, counted: false };
  }

  if (isExpectedPose && state.classifierArmed && now - state.lastRepAt >= 900) {
    state.classifierArmed = false;
    state.lastRepAt = now;
    return countPoseFrame(currentReps, targetReps, now);
  }

  return { nextReps: currentReps, counted: false };
};
