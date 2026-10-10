'use client';

import { isE2EMode } from '@/src/utils/e2eBridge';
import type { AnalyticsEventName, AnalyticsPropertiesByEvent, AnalyticsTrack } from './events';
import { getAnalyticsDistinctId } from './identity';

const ANALYTICS_ENDPOINT = '/api/analytics';

export const track: AnalyticsTrack = (event, properties) => {
  void sendAnalyticsEvent(event, properties);
};

async function sendAnalyticsEvent<TEvent extends AnalyticsEventName>(
  event: TEvent,
  properties: AnalyticsPropertiesByEvent[TEvent]
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'true') return;
  if (isE2EMode()) return;

  const distinctId = getAnalyticsDistinctId();
  if (!distinctId) return;

  try {
    await fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event,
        distinctId,
        properties,
        route: window.location.pathname,
      }),
    });
  } catch {
    // Analytics is intentionally non-blocking.
  }
}
