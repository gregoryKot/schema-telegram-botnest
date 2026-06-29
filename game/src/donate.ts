import { track } from './analytics';

// Game and app share the same backend at schemehappens.ru. Create a donation
// and send the player to the Robokassa payment page. Falls back to opening the
// app if the API is unreachable (e.g. local dev).
const API = 'https://schemehappens.ru/api/donation';

export async function donate(amount = 500): Promise<void> {
  track('donate_click', { amount, source: 'game' });
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, source: 'game' }),
    });
    const j = await r.json();
    if (j?.paymentUrl) { window.location.href = j.paymentUrl; return; }
  } catch { /* fall through to app */ }
  window.open('https://schemehappens.ru/?from=game', '_blank');
}
