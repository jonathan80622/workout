import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Activity, AlertTriangle, BarChart3, Bot, CheckCircle2, Database, RefreshCw } from 'lucide-react';
import { requireObservabilityViewerOrThrow } from '@/src/server/observability/auth';
import { getAnalyticsDashboardSummary } from '@/src/server/observability/analytics';

export const dynamic = 'force-dynamic';

export default async function ObservabilityDashboardPage() {
  const headerList = await headers();
  const request = new Request('http://localhost/_dashboard', {
    headers: { cookie: headerList.get('cookie') || '' },
  });

  try {
    await requireObservabilityViewerOrThrow(request);
  } catch (error) {
    return (
      <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee] px-5 py-10">
        <div className="mx-auto max-w-3xl border border-[#382f29] bg-[#181412] p-6">
          <p className="text-xs font-syne font-bold uppercase text-[#e6a15c]">Workout Observatory</p>
          <h1 className="mt-2 text-2xl font-serif font-bold">Sign in required</h1>
          <p className="mt-3 text-sm text-[#a39588]">
            Use the normal workout app sign-in, then return to this dashboard.
          </p>
        </div>
      </main>
    );
  }

  const analytics = await getAnalyticsDashboardSummary();
  const deliveryTotal = analytics.deliveryCounts.reduce((sum, row) => sum + row.count, 0);
  const problemDeliveries = analytics.deliveryCounts
    .filter((row) => row.status === 'retrying' || row.status === 'failed')
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <main className="min-h-screen bg-[#0c0a09] text-[#f7f3ee]">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#382f29] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-syne font-bold uppercase text-[#e6a15c]">Workout Observatory</p>
            <h1 className="mt-2 text-3xl font-serif font-bold tracking-tight">/_dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#a39588]">
              Durable product analytics, provider delivery state, and system health for the current deployment.
            </p>
          </div>
          <div className="text-xs text-[#a39588]">
            Environment <span className="font-mono text-[#f5c999]">{analytics.environment}</span>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 text-xs font-syne font-bold uppercase">
          <a href="#analytics" className="border border-[#d97724]/50 bg-[#d97724]/15 px-3 py-2 text-[#f5c999]">Analytics</a>
          <a href="#agents" className="border border-[#382f29] px-3 py-2 text-[#a39588]">Agents</a>
          <a href="#system" className="border border-[#382f29] px-3 py-2 text-[#a39588]">System</a>
        </nav>

        <section id="analytics" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric icon={<BarChart3 className="h-4 w-4" />} label="Events, 7 days" value={analytics.eventCount} />
            <Metric icon={<Activity className="h-4 w-4" />} label="Anonymous users" value={analytics.uniqueAnonymousIds} />
            <Metric icon={<RefreshCw className="h-4 w-4" />} label="Delivery rows" value={deliveryTotal} />
            <Metric icon={problemDeliveries ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} label="Delivery issues" value={problemDeliveries} tone={problemDeliveries ? 'warn' : 'ok'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="border border-[#382f29] bg-[#181412]">
              <PanelTitle title="Recent Events" subtitle="Newest canonical events accepted by /api/analytics." />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-y border-[#382f29] text-[#8c7e72]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Event</th>
                      <th className="px-4 py-2 font-medium">Route</th>
                      <th className="px-4 py-2 font-medium">Anonymous ID</th>
                      <th className="px-4 py-2 font-medium">Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentEvents.map((event) => (
                      <tr key={event.eventId} className="border-b border-[#241f1b]">
                        <td className="px-4 py-2 font-mono text-[#f5c999]">{event.name}</td>
                        <td className="px-4 py-2 text-[#d8cabe]">{event.route}</td>
                        <td className="px-4 py-2 font-mono text-[#8c7e72]">{shortId(event.anonymousId)}</td>
                        <td className="px-4 py-2 text-[#a39588]">{formatDateTime(event.recordedAt)}</td>
                      </tr>
                    ))}
                    {!analytics.recentEvents.length && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-[#8c7e72]">No analytics events recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="border border-[#382f29] bg-[#181412]">
              <PanelTitle title="Provider Delivery" subtitle="Per-destination delivery status and retry backlog." />
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  {(['mixpanel', 'ga4'] as const).map((destination) => (
                    <span key={destination} className={`border px-2 py-1 text-xs ${analytics.configuredDestinations.includes(destination) ? 'border-[#5b7f5f] text-[#9fd9a8]' : 'border-[#382f29] text-[#8c7e72]'}`}>
                      {destination} {analytics.configuredDestinations.includes(destination) ? 'configured' : 'off'}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  {analytics.deliveryCounts.map((row) => (
                    <div key={`${row.destination}-${row.status}`} className="flex items-center justify-between border-b border-[#241f1b] pb-2 text-sm">
                      <span className="font-mono text-[#d8cabe]">{row.destination}.{row.status}</span>
                      <span className="text-[#f5c999]">{row.count}</span>
                    </div>
                  ))}
                  {!analytics.deliveryCounts.length && <p className="text-sm text-[#8c7e72]">No delivery rows yet.</p>}
                </div>
              </div>
            </section>
          </div>
        </section>

        <section id="system" className="grid gap-4 lg:grid-cols-2">
          <section className="border border-[#382f29] bg-[#181412]">
            <PanelTitle title="Delivery Failures" subtitle="Retrying and failed rows that need attention." />
            <div className="space-y-3 p-4">
              {analytics.failedDeliveries.map((delivery) => (
                <div key={delivery.id} className="border-b border-[#241f1b] pb-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[#f5c999]">{delivery.destination}.{delivery.status}</span>
                    <span className="text-xs text-[#8c7e72]">{delivery.attempts} attempts</span>
                  </div>
                  <p className="mt-1 text-xs text-[#a39588]">{delivery.event.name} · next {formatDateTime(delivery.nextAttemptAt)}</p>
                  {delivery.errorMessage && <p className="mt-1 text-xs text-[#f5a99a]">{delivery.errorMessage}</p>}
                </div>
              ))}
              {!analytics.failedDeliveries.length && <p className="text-sm text-[#8c7e72]">No retrying or failed deliveries.</p>}
            </div>
          </section>

          <section className="border border-[#382f29] bg-[#181412]">
            <PanelTitle title="Reports" subtitle="Daily materialized comparison snapshots." />
            <div className="space-y-3 p-4">
              {analytics.reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between border-b border-[#241f1b] pb-2 text-sm">
                  <span className="text-[#d8cabe]">{report.reportDate}</span>
                  <span className="font-mono text-[#8c7e72]">{reportMetricSummary(report.metrics)}</span>
                </div>
              ))}
              {!analytics.reports.length && <p className="text-sm text-[#8c7e72]">Reports appear after an analytics delivery run.</p>}
            </div>
          </section>
        </section>

        <section id="agents" className="border border-[#382f29] bg-[#181412] p-5">
          <div className="flex items-center gap-2 text-[#f5c999]">
            <Bot className="h-4 w-4" />
            <h2 className="font-serif text-xl font-bold">Agent Tracing</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-[#a39588]">
            Reserved for the next phase. Bumstead run, span, model invocation, and artifact tables should be added only after the AI SDK transport-boundary capture proof verifies exact request snapshot durability.
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'text-[#9fd9a8]' : tone === 'warn' ? 'text-[#f5a99a]' : 'text-[#f5c999]';
  return (
    <div className="border border-[#382f29] bg-[#181412] p-4">
      <div className={`flex items-center gap-2 ${color}`}>{icon}<span className="text-xs font-syne font-bold uppercase">{label}</span></div>
      <p className="mt-3 text-3xl font-serif font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-2 p-4">
      <Database className="mt-0.5 h-4 w-4 text-[#e6a15c]" />
      <div>
        <h2 className="font-serif text-xl font-bold">{title}</h2>
        <p className="mt-1 text-xs text-[#8c7e72]">{subtitle}</p>
      </div>
    </div>
  );
}

function shortId(value: string): string {
  return value.length > 22 ? `${value.slice(0, 18)}...` : value;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function reportMetricSummary(metrics: unknown): string {
  if (!metrics || typeof metrics !== 'object') return 'no metrics';
  const eventCount = 'eventCount' in metrics ? Number((metrics as { eventCount?: unknown }).eventCount) : 0;
  const unique = 'uniqueAnonymousIds' in metrics ? Number((metrics as { uniqueAnonymousIds?: unknown }).uniqueAnonymousIds) : 0;
  return `${Number.isFinite(eventCount) ? eventCount : 0} events / ${Number.isFinite(unique) ? unique : 0} users`;
}
