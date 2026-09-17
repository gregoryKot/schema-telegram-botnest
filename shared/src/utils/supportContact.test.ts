import { describe, it, expect } from 'vitest';
import { supportContact } from './supportContact';

describe('supportContact', () => {
  it('в Telegram даёт телеграмный контакт автора', () => {
    expect(supportContact('telegram')).toEqual({
      url: 'https://t.me/kotlarewski',
      label: '@kotlarewski',
    });
  });

  // t.me внутри MAX — второй тупик подряд: мессенджер откроет ссылку во
  // внешнем браузере, а Telegram у человека может быть не установлен.
  it('в MAX даёт почту, а не ссылку на Telegram', () => {
    const { url, label } = supportContact('max');
    expect(url).toBe('mailto:gregorykot@gmail.com');
    expect(label).not.toContain('t.me');
  });

  it('в браузере и при неизвестной площадке — телеграмный контакт', () => {
    expect(supportContact('web').label).toBe('@kotlarewski');
    expect(supportContact(undefined).label).toBe('@kotlarewski');
  });

  // Подпись — сам адрес: «напиши нам» не говорит, кому пишешь.
  it('подпись содержит адрес целиком, а не местоимение', () => {
    for (const host of ['telegram', 'max', 'web'] as const) {
      const { url, label } = supportContact(host);
      expect(url.replace(/^https:\/\/t\.me\/|^mailto:/, '')).toBe(
        label.replace(/^@/, ''),
      );
    }
  });
});
