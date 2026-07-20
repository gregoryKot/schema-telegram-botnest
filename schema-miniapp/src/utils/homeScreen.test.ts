// Предложение «добавить значок на экран»: где показываем и когда возвращаем.
// Матрица целиком под тестом — часть веток наступает только через неделю,
// вживую их не прощёлкать.
import { describe, it, expect } from 'vitest';
import {
  canOfferHomeScreen,
  homeScreenPlatform,
  parseOfferMemory,
  shouldOfferHomeScreen,
  SNOOZE_DAYS,
  type OfferMemory,
} from './homeScreen';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

const offer = (over: {
  platform?: string;
  hasApi?: boolean;
  statusApiAvailable?: boolean;
  tgStatus?: 'unsupported' | 'unknown' | 'added' | 'missed';
  memory?: OfferMemory;
  now?: number;
}) =>
  shouldOfferHomeScreen({
    platform: 'ios',
    hasApi: true,
    // По умолчанию status-API нет (старый клиент) — тогда решает память.
    statusApiAvailable: false,
    memory: { kind: 'fresh' },
    now: NOW,
    ...over,
  });

describe('canOfferHomeScreen', () => {
  it('Android и iOS — предлагаем', () => {
    expect(canOfferHomeScreen('android', true)).toBe(true);
    expect(canOfferHomeScreen('android_x', true)).toBe(true);
    // На iOS нативная картинка Telegram врёт, но механизм рабочий — поэтому
    // предлагаем со своей подводкой, а не прячем возможность.
    expect(canOfferHomeScreen('ios', true)).toBe(true);
  });

  it('десктоп и веб-клиенты — не предлагаем', () => {
    for (const p of ['macos', 'tdesktop', 'weba', 'webk', 'unknown']) {
      expect(canOfferHomeScreen(p, true)).toBe(false);
    }
  });

  it('нет API (старый клиент) или неизвестна платформа — не предлагаем', () => {
    expect(canOfferHomeScreen('android', false)).toBe(false);
    expect(canOfferHomeScreen(undefined, true)).toBe(false);
  });

  it('платформа сводится к трём вариантам', () => {
    expect(homeScreenPlatform('android_x')).toBe('android');
    expect(homeScreenPlatform('ios')).toBe('ios');
    expect(homeScreenPlatform('tdesktop')).toBe('other');
    expect(homeScreenPlatform(undefined)).toBe('other');
  });
});

describe('память предложения', () => {
  it('разбирает сырое значение, мусор считает пустым', () => {
    expect(parseOfferMemory(null)).toEqual({ kind: 'fresh' });
    expect(parseOfferMemory('added')).toEqual({ kind: 'added' });
    expect(parseOfferMemory('never')).toEqual({ kind: 'never' });
    expect(parseOfferMemory('12345')).toEqual({
      kind: 'snoozed',
      until: 12345,
    });
    expect(parseOfferMemory('чепуха')).toEqual({ kind: 'fresh' });
    expect(parseOfferMemory('-5')).toEqual({ kind: 'fresh' });
  });
});

describe('shouldOfferHomeScreen', () => {
  it('первый раз — предлагаем', () => {
    expect(offer({})).toBe(true);
  });

  it('отказался совсем — больше никогда', () => {
    expect(offer({ memory: { kind: 'never' } })).toBe(false);
    expect(offer({ memory: { kind: 'never' }, now: NOW + 365 * DAY })).toBe(
      false,
    );
  });

  it('«позже» — молчим неделю, потом предлагаем снова', () => {
    const memory: OfferMemory = {
      kind: 'snoozed',
      until: NOW + SNOOZE_DAYS * DAY,
    };
    expect(offer({ memory, now: NOW + DAY })).toBe(false);
    expect(offer({ memory, now: NOW + 6 * DAY })).toBe(false);
    expect(offer({ memory, now: NOW + SNOOZE_DAYS * DAY })).toBe(true);
    expect(offer({ memory, now: NOW + 10 * DAY })).toBe(true);
  });

  it('значок уже стоит — не предлагаем (слово Telegram важнее памяти)', () => {
    expect(offer({ tgStatus: 'added' })).toBe(false);
    expect(offer({ memory: { kind: 'added' } })).toBe(false);
  });

  it('отметка «добавлено» устарела — значка нет, предлагаем снова', () => {
    expect(offer({ memory: { kind: 'added' }, tgStatus: 'missed' })).toBe(true);
  });

  // Баг: карточка показывалась даже при существующем значке. Причина —
  // оптимистичный показ до ответа checkHomeScreenStatus.
  it('status-API есть, но ответ ещё не пришёл — молчим (не мигаем)', () => {
    expect(offer({ statusApiAvailable: true, tgStatus: undefined })).toBe(
      false,
    );
    // как только пришёл «значка нет» — показываем
    expect(offer({ statusApiAvailable: true, tgStatus: 'missed' })).toBe(true);
  });

  it('status-API нет (старый клиент) — решает память, не ждём ответа', () => {
    expect(offer({ statusApiAvailable: false, tgStatus: undefined })).toBe(
      true,
    );
  });

  // Баг: кнопка показывалась, но не работала (метод-заглушка без поддержки).
  it('клиент говорит unsupported — не показываем нерабочую кнопку', () => {
    expect(offer({ statusApiAvailable: true, tgStatus: 'unsupported' })).toBe(
      false,
    );
    // даже при «свежей» памяти и явном missed-соседе
    expect(
      offer({
        statusApiAvailable: true,
        tgStatus: 'unsupported',
        memory: { kind: 'fresh' },
      }),
    ).toBe(false);
  });

  it('unknown-статус — недостоверно, но предлагаем (лучше показать)', () => {
    expect(offer({ statusApiAvailable: true, tgStatus: 'unknown' })).toBe(true);
  });

  it('чужая платформа / нет API — не предлагаем, что бы ни было в памяти', () => {
    expect(offer({ platform: 'tdesktop' })).toBe(false);
    expect(offer({ platform: 'tdesktop', tgStatus: 'missed' })).toBe(false);
    // hasApi=false = старый клиент без рабочего addToHomeScreen (версия < 8.0)
    expect(offer({ hasApi: false })).toBe(false);
    expect(offer({ hasApi: false, tgStatus: 'missed' })).toBe(false);
  });
});
