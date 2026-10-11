-- Sign-in now uses only the existing Google client ID, so no refresh token is ever stored.
-- Refuse to drop the column if any row holds one, so a deploy fails instead of losing data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "accounts" WHERE "encrypted_refresh_token" IS NOT NULL) THEN
    RAISE EXCEPTION 'accounts.encrypted_refresh_token is not empty; refusing to drop';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "encrypted_refresh_token";

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_account_id_idx" ON "sessions"("account_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

