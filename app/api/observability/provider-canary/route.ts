import { NextResponse } from 'next/server';
import { requireObservabilityViewer } from '@/src/server/observability/auth';
import { verifyAnalyticsProviders } from '@/src/server/observability/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const viewer = await requireObservabilityViewer(request);
  if (viewer instanceof NextResponse) return viewer;

  const verification = await verifyAnalyticsProviders();
  return NextResponse.json({ verification }, { headers: { 'Cache-Control': 'no-store' } });
}
