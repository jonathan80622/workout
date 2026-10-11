-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "google_sub" TEXT NOT NULL,
    "email" TEXT,
    "encrypted_refresh_token" TEXT,
    "owner_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_google_sub_key" ON "accounts"("google_sub");

-- CreateIndex
CREATE INDEX "accounts_owner_user_id_idx" ON "accounts"("owner_user_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

