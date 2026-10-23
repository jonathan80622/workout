'use client';

import { useState } from 'react';
import { FlaskConical, LoaderCircle } from 'lucide-react';

type Verification = {
  eventName: string;
  nonce: string;
  mixpanel: { configured: boolean; status: number | null; accepted: boolean; result: unknown };
  ga4: { configured: boolean; collectionStatus: number | null; validationStatus: number | null; validation: unknown };
};

export function AnalyticsProviderVerification() {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function runVerification() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/observability/provider-canary', { method: 'POST' });
      const body = await response.json().catch(() => null) as { verification?: Verification; error?: string } | null;
      if (!response.ok || !body?.verification) throw new Error(body?.error || `Verification failed with HTTP ${response.status}.`);
      setVerification(body.verification);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="border-b border-[#241f1b] p-4">
      <button type="button" onClick={runVerification} disabled={running} className="inline-flex items-center gap-2 border border-[#d97724]/50 px-3 py-2 text-xs font-syne font-bold uppercase text-[#f5c999] disabled:cursor-not-allowed disabled:opacity-60">
        {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
        Verify provider delivery
      </button>
      {error && <p className="mt-2 text-xs text-[#f5a99a]">{error}</p>}
      {verification && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap border border-[#382f29] bg-[#0c0a09] p-3 text-xs text-[#d8cabe]">{JSON.stringify(verification, null, 2)}</pre>}
    </div>
  );
}
