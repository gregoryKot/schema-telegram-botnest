// @vitest-environment jsdom
// Привязка VK ID и Яндекс ID уходит редиректом в том же окне — во фрейме веб-версии
// мессенджера это обрыв без объяснения, поэтому «Аккаунт» спрашивает признак здесь.
import { afterEach, describe, expect, it } from 'vitest';
import { messengerFrame } from './messengerFrame';
import { setHost } from './index';
import type { HostId } from './types';

const host = (id: HostId, platform?: string) => ({ id, platform });
/** Окно верхнего уровня: само себе top. */
const own = {
  get top() {
    return this;
  },
  get self() {
    return this;
  },
} as unknown as Window;
/** Окно во фрейме: сверху чужая страница. */
const framed = { top: {}, self: {} } as unknown as Window;

afterEach(() => {
  delete (globalThis as { Telegram?: unknown }).Telegram;
  setHost(null);
});

describe('messengerFrame', () => {
  it.each(['weba', 'webk', 'web'])(
    'Telegram Web («%s») — фрейм Telegram',
    (p) => {
      expect(messengerFrame(host('telegram', p), own)).toBe('telegram');
    },
  );

  it('MAX в браузере (web) — фрейм MAX', () => {
    expect(messengerFrame(host('max', 'web'), own)).toBe('max');
  });

  it.each([
    ['telegram', 'ios'],
    ['telegram', 'android'],
    ['telegram', 'tdesktop'],
    ['telegram', 'macos'],
    ['max', 'ios'],
    ['max', 'android'],
    ['max', 'desktop'],
    ['telegram', undefined],
  ] as const)('нативный клиент %s/%s без фрейма — null', (id, p) => {
    expect(messengerFrame(host(id, p), own)).toBeNull();
  });

  it('незнакомая платформа, но окно во фрейме — тоже фрейм мессенджера', () => {
    expect(messengerFrame(host('max', 'desktop'), framed)).toBe('max');
    expect(messengerFrame(host('telegram', 'unknown'), framed)).toBe(
      'telegram',
    );
  });

  it('обычный браузер — null, даже во фрейме и с «web» в платформе', () => {
    expect(messengerFrame(host('web', 'web'), framed)).toBeNull();
    expect(messengerFrame(host('web', 'desktop'), own)).toBeNull();
  });

  it('без окна решает платформа', () => {
    expect(messengerFrame(host('telegram', 'weba'), undefined)).toBe(
      'telegram',
    );
    expect(messengerFrame(host('telegram', 'ios'), undefined)).toBeNull();
  });

  it('без аргументов читает живой хост: подпись Telegram Web в окне — фрейм Telegram', () => {
    expect(messengerFrame()).toBeNull();
    (globalThis as { Telegram?: unknown }).Telegram = {
      WebApp: { platform: 'webk', initData: 'user=%7B%7D&hash=a' },
    };
    setHost(null);
    expect(messengerFrame()).toBe('telegram');
  });
});
