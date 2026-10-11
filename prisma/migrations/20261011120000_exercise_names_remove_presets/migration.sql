-- Rename in place to retain every logged exercise name.
ALTER TABLE "exercise_logs" RENAME COLUMN "machine_name" TO "exercise_name";
DROP TABLE "machine_presets";
DROP TYPE "EquipmentType";
ALTER TABLE "users" ADD COLUMN "state_revision" INTEGER NOT NULL DEFAULT 0;
