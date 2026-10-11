-- Move the signed-in Google account ID onto the imported user, replacing the placeholder
-- auth_subject 'legacy-import:workout-data', then drop accounts. Workout rows reference
-- users.id, which does not change. One DO block, so it applies completely or not at all.
-- Refuses unless there is exactly one account, exactly one CLIENT user, and that user is the
-- imported one; a refusal fails the deploy before the new app ships.
DO $$
DECLARE
  account_count integer;
  client_count integer;
  legacy_client_count integer;
  client_id uuid;
BEGIN
  SELECT count(*) INTO account_count FROM "accounts";
  SELECT count(*) INTO client_count FROM "users" WHERE "role" = 'CLIENT';
  SELECT count(*) INTO legacy_client_count FROM "users"
    WHERE "auth_subject" = 'legacy-import:workout-data' AND "role" = 'CLIENT';
  IF account_count <> 1 OR client_count <> 1 OR legacy_client_count <> 1 THEN
    RAISE EXCEPTION 'Refusing identity migration: % accounts, % CLIENT users, % imported CLIENT users (expected 1 each)',
      account_count, client_count, legacy_client_count;
  END IF;

  SELECT "id" INTO client_id FROM "users" WHERE "auth_subject" = 'legacy-import:workout-data';
  UPDATE "users" SET "auth_subject" = (SELECT "google_sub" FROM "accounts") WHERE "id" = client_id;

  -- Existing sessions all belong to the one account, so they move to the user and stay signed in.
  ALTER TABLE "sessions" ADD COLUMN "user_id" UUID;
  UPDATE "sessions" SET "user_id" = client_id;
  ALTER TABLE "sessions" ALTER COLUMN "user_id" SET NOT NULL;
  ALTER TABLE "sessions" DROP CONSTRAINT "sessions_account_id_fkey";
  DROP INDEX "sessions_account_id_idx";
  ALTER TABLE "sessions" DROP COLUMN "account_id";
  CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  DROP TABLE "accounts";
END $$;
