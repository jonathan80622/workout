'use client';

import { isE2EMode } from '@/src/utils/e2eBridge';
import type { AnalyticsEventName, AnalyticsPropertiesByEvent, AnalyticsTrack, AnalyticsTrackOptions } from './events';
import { getAnalyticsDistinctId } from './identity';

const ANALYTICS_ENDPOINT = '/api/analytics';
type AnalyticsWindow = Window & {
  __workoutGaMeasurementId?: string;
  gtag?: (command: 'get', measurementId: string, field: 'client_id', callback: (value: unknown) => void) => void;
};

export const track: AnalyticsTrack = (event, properties, options) => {
  void sendAnalyticsEvent(event, properties, options);
};

async function sendAnalyticsEvent<TEvent extends AnalyticsEventName>(
  event: TEvent,
  properties: AnalyticsPropertiesByEvent[TEvent],
  options?: AnalyticsTrackOptions
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isE2EMode()) return;

  const distinctId = getAnalyticsDistinctId();
  if (!distinctId) return;
  const gaClientId = await getGaClientId();

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
        gaClientId,
      }),
    });
  } catch {
    // Analytics is intentionally non-blocking.
  }
}

function getGaClientId(): Promise<string | undefined> {
  const analyticsWindow = window as AnalyticsWindow;
  const measurementId = analyticsWindow.__workoutGaMeasurementId;
  if (!measurementId || !analyticsWindow.gtag) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(undefined), 500);
    analyticsWindow.gtag!('get', measurementId, 'client_id', (value) => {
      window.clearTimeout(timeout);
      resolve(typeof value === 'string' && value.length <= 120 ? value : undefined);
    });
  });
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
