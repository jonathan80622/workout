-- Chat messages are stored as AI SDK UIMessages: the client-visible id, ordered parts and metadata.
-- active_stream_id points at the Redis-backed resumable stream while a reply is generating.
ALTER TABLE "chat_conversations" ADD COLUMN "active_stream_id" TEXT;

ALTER TABLE "chat_messages"
  ADD COLUMN "ui_message_id" TEXT,
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parts" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "metadata" JSONB;
UPDATE "chat_messages" SET "ui_message_id" = "id"::text WHERE "ui_message_id" IS NULL;
ALTER TABLE "chat_messages" ALTER COLUMN "ui_message_id" SET NOT NULL;

CREATE UNIQUE INDEX "chat_messages_conversation_id_ui_message_id_key" ON "chat_messages"("conversation_id", "ui_message_id");
