import { WorkoutTrackerApp } from '@/src/components/WorkoutTrackerApp';
import { createDefaultAppState, splitWorkouts } from '@/src/utils/driveStorage';

export default function HomePage() {
  const state = createDefaultAppState();
  const data = splitWorkouts(state.workouts);

  return (
    <WorkoutTrackerApp
      initialProfile={state.profile}
      initialWorkouts={data.completedWorkouts}
      initialActiveWorkout={data.activeWorkout}
      initialMachines={state.machines}
      initialScheduledSession={state.scheduledSession}
      initialTrainingPlan={state.trainingPlan}
      initialWarmupCheckins={state.warmupCheckins}
    />
  );
}
