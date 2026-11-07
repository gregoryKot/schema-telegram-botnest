import { describe, it, expect } from 'vitest';
import { bookingUrl, telegramUrl } from './therapyBridgeLinks';
import type { TherapyNudgePlace } from '../../analytics/therapyNudge';

describe('therapyBridgeLinks', () => {
  it('bookingUrl несёт место в метке from и якорь записи', () => {
    expect(bookingUrl('signal_card')).toBe(
      'https://kotlarewski.gr/?from=app_signal_card#booking',
    );
  });

  it('на каждое место — своя метка', () => {
    const places: TherapyNudgePlace[] = [
      'home',
      'tracker_done',
      'case_done',
      'diary_done',
      'more',
      'signal_card',
    ];
    const urls = places.map(bookingUrl);
    expect(new Set(urls).size).toBe(places.length);
    for (const [i, p] of places.entries())
      expect(urls[i]).toContain(`from=app_${p}#booking`);
  });

  it('telegramUrl — Telegram автора', () => {
    expect(telegramUrl()).toBe('https://t.me/kotlarewski');
  });
});
