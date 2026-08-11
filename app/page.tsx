import { getAppData } from './actions';
import { WorkoutTrackerApp } from '@/src/components/WorkoutTrackerApp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const data = await getAppData();

  return (
    <WorkoutTrackerApp
      initialProfile={data.profile}
      initialWorkouts={data.workouts}
      initialActiveWorkout={data.activeWorkout}
      initialMachines={data.machines}
      initialScheduledSession={data.scheduledSession}
    />
  );
}
