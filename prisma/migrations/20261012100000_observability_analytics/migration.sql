CREATE TYPE "AnalyticsDestination" AS ENUM ('mixpanel', 'ga4');

CREATE TYPE "AnalyticsDeliveryStatus" AS ENUM ('pending', 'processing', 'delivered', 'retrying', 'failed', 'disabled');

CREATE TABLE "analytics_events" (
    "event_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "user_id" UUID,
    "anonymous_id" TEXT NOT NULL,
    "correlation_id" TEXT,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "properties" JSONB NOT NULL,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("event_id")
);

CREATE TABLE "analytics_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" TEXT NOT NULL,
    "destination" "AnalyticsDestination" NOT NULL,
    "status" "AnalyticsDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMPTZ(6),
    "provider_ack_id" TEXT,
    "error_message" TEXT,

    CONSTRAINT "analytics_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_date" DATE NOT NULL,
    "environment" TEXT NOT NULL,
    "destination" TEXT NOT NULL DEFAULT 'canonical',
    "metrics" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "analytics_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_environment_occurred_at_idx" ON "analytics_events"("environment", "occurred_at");
CREATE INDEX "analytics_events_name_occurred_at_idx" ON "analytics_events"("name", "occurred_at");
CREATE INDEX "analytics_events_anonymous_id_occurred_at_idx" ON "analytics_events"("anonymous_id", "occurred_at");
CREATE INDEX "analytics_events_user_id_occurred_at_idx" ON "analytics_events"("user_id", "occurred_at");

CREATE UNIQUE INDEX "analytics_deliveries_event_id_destination_key" ON "analytics_deliveries"("event_id", "destination");
CREATE INDEX "analytics_deliveries_destination_status_next_attempt_at_idx" ON "analytics_deliveries"("destination", "status", "next_attempt_at");
CREATE INDEX "analytics_deliveries_lease_expires_at_idx" ON "analytics_deliveries"("lease_expires_at");

CREATE UNIQUE INDEX "analytics_reports_report_date_environment_destination_key" ON "analytics_reports"("report_date", "environment", "destination");
CREATE INDEX "analytics_reports_environment_report_date_idx" ON "analytics_reports"("environment", "report_date");

ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "analytics_deliveries" ADD CONSTRAINT "analytics_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "analytics_events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;
