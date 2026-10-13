'use client';

import { isE2EMode } from '@/src/utils/e2eBridge';
import type { AnalyticsEventName, AnalyticsPropertiesByEvent, AnalyticsTrack, AnalyticsTrackOptions } from './events';
import { getAnalyticsDistinctId } from './identity';

const ANALYTICS_ENDPOINT = '/api/analytics';

export const track: AnalyticsTrack = (event, properties, options) => {
  void sendAnalyticsEvent(event, properties, options);
};

async function sendAnalyticsEvent<TEvent extends AnalyticsEventName>(
  event: TEvent,
  properties: AnalyticsPropertiesByEvent[TEvent],
  options?: AnalyticsTrackOptions
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
        eventId: createEventId(),
        occurredAt: new Date().toISOString(),
        distinctId,
        properties,
        route: window.location.pathname,
        correlationId: options?.correlationId,
      }),
    });
  } catch {
    // Analytics is intentionally non-blocking.
  }
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
