import { NextResponse } from 'next/server';
import { requireObservabilityAdmin } from '@/src/server/observability/auth';
import { getAnalyticsDashboardSummary } from '@/src/server/observability/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await requireObservabilityAdmin(request);
  if (admin instanceof NextResponse) return admin;

  const analytics = await getAnalyticsDashboardSummary();
  return NextResponse.json({ analytics }, { headers: { 'Cache-Control': 'no-store' } });
}
