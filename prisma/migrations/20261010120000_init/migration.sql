-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PT');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('lbs', 'kg');

-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('warmup', 'working', 'drop', 'failure');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('MACHINE', 'CABLE', 'FREE_WEIGHT', 'SMITH_MACHINE', 'CARDIO_TREADMILL');

-- CreateEnum
CREATE TYPE "ScheduledSessionStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "FeedbackSource" AS ENUM ('imported_pt_local', 'pt_portal', 'api');

-- CreateEnum
CREATE TYPE "ChatMessageRole" AS ENUM ('user', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('drive_json', 'browser_local_storage', 'body_weight_local_storage', 'pt_local_comments');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "auth_subject" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "client_name" TEXT NOT NULL,
    "pt_name_label" TEXT,
    "app_title" TEXT,
    "theme_color" TEXT,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "title" TEXT NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "start_time_raw" TEXT,
    "end_time_raw" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "is_completed" BOOLEAN NOT NULL,
    "pt_notes" TEXT,
    "pt_comment" TEXT,
    "running_distance" DECIMAL(10,3),
    "running_time_minutes" DECIMAL(10,3),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_logs" (
    "id" UUID NOT NULL,
    "workout_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "position" INTEGER NOT NULL,
    "machine_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "seat_settings" TEXT,
    "notes" TEXT,
    "distance" DECIMAL(10,3),
    "running_time_minutes" DECIMAL(10,3),
    "pt_comment" TEXT,

    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" UUID NOT NULL,
    "exercise_log_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "position" INTEGER NOT NULL,
    "set_number" INTEGER NOT NULL,
    "type" "SetType" NOT NULL,
    "weight" DECIMAL(10,3) NOT NULL,
    "weight_unit" "WeightUnit" NOT NULL,
    "reps" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "rpe" DECIMAL(3,1),
    "distance" DECIMAL(10,3),
    "running_time_minutes" DECIMAL(10,3),

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_presets" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "equipment_type" "EquipmentType" NOT NULL,
    "default_seat_settings" TEXT,
    "target_description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "machine_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_blocks" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "accent" TEXT,

    CONSTRAINT "training_plan_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plan_exercises" (
    "id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sets_text" TEXT NOT NULL,
    "reps_text" TEXT NOT NULL,
    "rest_text" TEXT NOT NULL,

    CONSTRAINT "training_plan_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warmup_moves" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "target_text" TEXT NOT NULL,

    CONSTRAINT "warmup_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warmup_checkins" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "checkin_date" DATE NOT NULL,
    "move_id_or_legacy_key" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL,

    CONSTRAINT "warmup_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_sessions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "title" TEXT NOT NULL,
    "scheduled_date" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "status" "ScheduledSessionStatus" NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "scheduled_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_weight_entries" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "date" DATE NOT NULL,
    "weight_kg" DECIMAL(7,3) NOT NULL,
    "source_value" DECIMAL(7,3) NOT NULL,
    "source_unit" "WeightUnit" NOT NULL,

    CONSTRAINT "body_weight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "exercise_log_id" UUID NOT NULL,
    "legacy_id" TEXT,
    "drive_file_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "duration_seconds" DECIMAL(10,3) NOT NULL,
    "mime_type" TEXT NOT NULL,
    "name" TEXT,
    "web_view_link" TEXT,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_feedback" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "workout_id" UUID NOT NULL,
    "exercise_log_id" UUID,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "FeedbackSource" NOT NULL,

    CONSTRAINT "trainer_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "ChatMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "source_type" "ImportSourceType" NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "report_json" JSONB,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_subject_key" ON "users"("auth_subject");

-- CreateIndex
CREATE INDEX "workouts_owner_id_date_idx" ON "workouts"("owner_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "workouts_owner_id_legacy_id_key" ON "workouts"("owner_id", "legacy_id");

-- CreateIndex
CREATE INDEX "exercise_logs_workout_id_position_idx" ON "exercise_logs"("workout_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_logs_workout_id_legacy_id_key" ON "exercise_logs"("workout_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_logs_id_workout_id_key" ON "exercise_logs"("id", "workout_id");

-- CreateIndex
CREATE INDEX "workout_sets_exercise_log_id_position_idx" ON "workout_sets"("exercise_log_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sets_exercise_log_id_legacy_id_key" ON "workout_sets"("exercise_log_id", "legacy_id");

-- CreateIndex
CREATE INDEX "machine_presets_owner_id_position_idx" ON "machine_presets"("owner_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "machine_presets_owner_id_legacy_id_key" ON "machine_presets"("owner_id", "legacy_id");

-- CreateIndex
CREATE INDEX "training_plans_owner_id_is_current_idx" ON "training_plans"("owner_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_blocks_plan_id_position_key" ON "training_plan_blocks"("plan_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_blocks_plan_id_legacy_id_key" ON "training_plan_blocks"("plan_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_exercises_block_id_position_key" ON "training_plan_exercises"("block_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_exercises_block_id_legacy_id_key" ON "training_plan_exercises"("block_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "warmup_moves_plan_id_position_key" ON "warmup_moves"("plan_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "warmup_moves_plan_id_legacy_id_key" ON "warmup_moves"("plan_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "warmup_checkins_owner_id_checkin_date_move_id_or_legacy_key_key" ON "warmup_checkins"("owner_id", "checkin_date", "move_id_or_legacy_key");

-- CreateIndex
CREATE INDEX "scheduled_sessions_owner_id_scheduled_date_idx" ON "scheduled_sessions"("owner_id", "scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_sessions_owner_id_legacy_id_key" ON "scheduled_sessions"("owner_id", "legacy_id");

-- CreateIndex
CREATE INDEX "body_weight_entries_owner_id_date_idx" ON "body_weight_entries"("owner_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "body_weight_entries_owner_id_legacy_id_key" ON "body_weight_entries"("owner_id", "legacy_id");

-- CreateIndex
CREATE INDEX "videos_drive_file_id_idx" ON "videos"("drive_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "videos_exercise_log_id_legacy_id_key" ON "videos"("exercise_log_id", "legacy_id");

-- CreateIndex
CREATE INDEX "trainer_feedback_workout_id_created_at_idx" ON "trainer_feedback"("workout_id", "created_at");

-- CreateIndex
CREATE INDEX "trainer_feedback_exercise_log_id_created_at_idx" ON "trainer_feedback"("exercise_log_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_conversations_owner_id_updated_at_idx" ON "chat_conversations"("owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "import_batches_owner_id_started_at_idx" ON "import_batches"("owner_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_owner_id_source_type_checksum_key" ON "import_batches"("owner_id", "source_type", "checksum");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "exercise_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_presets" ADD CONSTRAINT "machine_presets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_blocks" ADD CONSTRAINT "training_plan_blocks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_exercises" ADD CONSTRAINT "training_plan_exercises_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "training_plan_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warmup_moves" ADD CONSTRAINT "warmup_moves_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warmup_checkins" ADD CONSTRAINT "warmup_checkins_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_weight_entries" ADD CONSTRAINT "body_weight_entries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "exercise_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_feedback" ADD CONSTRAINT "trainer_feedback_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_feedback" ADD CONSTRAINT "trainer_feedback_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_feedback" ADD CONSTRAINT "trainer_feedback_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "exercise_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom constraints not represented directly in Prisma's schema language.
CREATE UNIQUE INDEX "training_plans_one_current_per_owner"
ON "training_plans"("owner_id")
WHERE "is_current" = true;

ALTER TABLE "workout_sets"
ADD CONSTRAINT "workout_sets_rpe_bounds"
CHECK ("rpe" IS NULL OR ("rpe" >= 1 AND "rpe" <= 10));

ALTER TABLE "workout_sets"
ADD CONSTRAINT "workout_sets_nonnegative_values"
CHECK (
  "weight" >= 0
  AND "reps" >= 0
  AND ("distance" IS NULL OR "distance" >= 0)
  AND ("running_time_minutes" IS NULL OR "running_time_minutes" >= 0)
);

ALTER TABLE "body_weight_entries"
ADD CONSTRAINT "body_weight_entries_positive_values"
CHECK ("weight_kg" > 0 AND "source_value" > 0);

ALTER TABLE "videos"
ADD CONSTRAINT "videos_positive_duration"
CHECK ("duration_seconds" >= 0);

ALTER TABLE "trainer_feedback"
ADD CONSTRAINT "trainer_feedback_exercise_matches_workout"
FOREIGN KEY ("exercise_log_id", "workout_id")
REFERENCES "exercise_logs"("id", "workout_id")
ON DELETE CASCADE
ON UPDATE CASCADE;
