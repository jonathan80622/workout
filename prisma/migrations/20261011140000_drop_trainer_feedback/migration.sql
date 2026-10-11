-- PT comments live in workouts.pt_comment / exercise_logs.pt_comment; this table was never written.
-- Refuse to drop if any rows exist, so a deploy fails instead of losing data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "trainer_feedback") THEN
    RAISE EXCEPTION 'trainer_feedback is not empty; refusing to drop';
  END IF;
END $$;

DROP TABLE "trainer_feedback";
DROP TYPE "FeedbackSource";
