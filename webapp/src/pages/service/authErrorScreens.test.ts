// Исход листа /auth/error по коду причины (b26): устарело и лимит — «подожди», отказ сервера —
// «граница», сбой и неизвестное — «на нашей стороне». Коды — словарь authErrorReasons.ts.
import { describe, it, expect } from 'vitest';
import { authErrorOutcome, authErrorScreen } from './authErrorScreens';

describe('authErrorOutcome', () => {
  it.each([
    ['email_link_expired', 'wait'], ['email_network', 'wait'], ['telegram_expired', 'wait'],
    ['google_disabled', 'wait'], ['vk_disabled', 'wait'], ['http_429', 'wait'],
    ['http_401', 'limit'], ['http_403', 'limit'],
    ['google_failed', 'our_side'], ['telegram_no_data', 'our_side'], ['http_503', 'our_side'], [null, 'our_side'],
  ] as const)('%s → %s', (code, outcome) => {
    expect(authErrorOutcome(code)).toBe(outcome);
  });

  it('у кода со своим экраном исход тоже есть, неизвестному — «на нашей стороне»', () => {
    expect(authErrorScreen('email_link_expired')?.title).toBe('Ссылка устарела');
    expect(authErrorOutcome('email_link_expired')).toBe('wait');
    expect(authErrorOutcome('zzz_made_up')).toBe('our_side');
  });
});
