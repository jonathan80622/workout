import { randomUUID } from 'node:crypto';

const mixpanelToken = required('MIXPANEL_PROJECT_TOKEN');
const measurementId = required('GA4_MEASUREMENT_ID');
const apiSecret = required('GA4_API_SECRET');
const nonce = randomUUID();
const eventName = 'analytics_provider_canary';
const occurredAt = new Date();
const clientId = `999999999.${occurredAt.getTime()}`;

const mixpanelPayload = {
  event: eventName,
  properties: {
    token: mixpanelToken,
    distinct_id: `analytics_canary_${nonce}`,
    $insert_id: nonce,
    time: Math.floor(occurredAt.getTime() / 1000),
    source: 'provider_verification',
  },
};
const mixpanelResponse = await fetch('https://api.mixpanel.com/track?verbose=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ data: Buffer.from(JSON.stringify(mixpanelPayload)).toString('base64') }),
});
const mixpanelResult = await readJsonOrText(mixpanelResponse);

const gaPayload = {
  client_id: clientId,
  timestamp_micros: String(occurredAt.getTime() * 1000),
  events: [{
    name: eventName,
    params: {
      event_id: nonce,
      source: 'provider_verification',
      engagement_time_msec: 1,
      debug_mode: true,
    },
  }],
};
const gaQuery = new URLSearchParams({ measurement_id: measurementId, api_secret: apiSecret });
const [gaCollectionResponse, gaValidationResponse] = await Promise.all([
  fetch(`https://www.google-analytics.com/mp/collect?${gaQuery}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gaPayload),
  }),
  fetch(`https://www.google-analytics.com/debug/mp/collect?${gaQuery}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gaPayload),
  }),
]);
const gaValidation = await readJsonOrText(gaValidationResponse);

console.log(JSON.stringify({
  eventName,
  nonce,
  mixpanel: { status: mixpanelResponse.status, result: mixpanelResult },
  ga4: {
    collectionStatus: gaCollectionResponse.status,
    validationStatus: gaValidationResponse.status,
    validation: gaValidation,
  },
}, null, 2));

if (!mixpanelResponse.ok || mixpanelResult?.status !== 1 || !gaCollectionResponse.ok || !gaValidationResponse.ok || gaValidation?.validationMessages?.length) {
  process.exitCode = 1;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set to run the provider canary.`);
  return value;
}

async function readJsonOrText(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
