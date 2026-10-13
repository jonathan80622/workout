import { NextResponse } from 'next/server';
import { materializeAnalyticsReport, processAnalyticsDeliveries } from '@/src/server/observability/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secrets = [process.env.OBSERVABILITY_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (!secrets.some((secret) => request.headers.get('authorization') === `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const deliveries = await processAnalyticsDeliveries();
  const report = await materializeAnalyticsReport();
  return NextResponse.json({
    deliveries,
    report: {
      id: report.id,
      reportDate: report.reportDate.toISOString().slice(0, 10),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
