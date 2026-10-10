ALTER TABLE "workout_sets" DROP CONSTRAINT "workout_sets_nonnegative_values";

ALTER TABLE "workout_sets"
  ADD CONSTRAINT "workout_sets_nonnegative_reps_distance_time"
  CHECK (
    "reps" >= 0
    AND ("distance" IS NULL OR "distance" >= 0)
    AND ("running_time_minutes" IS NULL OR "running_time_minutes" >= 0)
  );
