import { NextResponse } from 'next/server';
import { requireObservabilityViewer } from '@/src/server/observability/auth';
import { getAnalyticsDashboardSummary } from '@/src/server/observability/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const viewer = await requireObservabilityViewer(request);
  if (viewer instanceof NextResponse) return viewer;

  const analytics = await getAnalyticsDashboardSummary();
  return NextResponse.json({ analytics }, { headers: { 'Cache-Control': 'no-store' } });
}
