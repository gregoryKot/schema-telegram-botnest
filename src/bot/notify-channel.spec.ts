// Выбор канала уведомления (notify-channel.ts) — одна функция на очередь и на
// экран настроек (правило №4). Здесь: само правило, ответ экрану и фильтр
// планировщика с ключами VAPID и без.
import { generateVAPIDKeys } from 'web-push';
import { notifyAudience, notifyChannel, notifyRouteOf } from './notify-channel';
import { toSendSettings } from './send-settings';

const base = {
  id: 1_000_000_000_000_001n,
  notifyTimezone: 'Europe/Moscow',
  notifyQuietStart: 22,
  notifyQuietEnd: 8,
  addressForm: null,
};

describe('notifyChannel', () => {
  it.each([
    [true, 42n, 'push'], // пуш выигрывает у Telegram намеренно
    [true, null, 'push'],
    [false, 42n, 'telegram'],
    [false, null, null],
  ] as const)('hasPush=%s chatId=%s → %s', (hasPush, chatId, channel) => {
    expect(notifyChannel({ hasPush, chatId })).toBe(channel);
  });
});

describe('notifyRouteOf — ответ экрану по тем же настройкам, что у очереди', () => {
  it('веб-аккаунт с подпиской: push, Telegram не привязан', () => {
    expect(notifyRouteOf(toSendSettings(base, true))).toEqual({
      channel: 'push',
      telegramLinked: false,
    });
  });

  it('привязан Telegram и есть подписка: push, но Telegram виден («вместо Telegram»)', () => {
    const s = toSendSettings(
      { ...base, authProviders: [{ providerId: '77' }] },
      true,
    );
    expect(notifyRouteOf(s)).toEqual({ channel: 'push', telegramLinked: true });
  });

  it('строки нет — некуда', () => {
    expect(notifyRouteOf(undefined)).toEqual({
      channel: null,
      telegramLinked: false,
    });
  });
});

describe('notifyAudience — кого рассматривает планировщик', () => {
  const env = process.env;
  afterEach(() => {
    process.env = env;
  });

  it('без ключей VAPID — только Telegram-ветка', () => {
    process.env = { ...env, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' };
    const audience = notifyAudience();
    expect(audience).toHaveLength(1);
    expect(audience[0]).toMatchObject({ botBlockedAt: null });
  });

  it('с ключами — подписчики в выборке и без Telegram, и с заблокированным ботом', () => {
    const k = generateVAPIDKeys();
    process.env = {
      ...env,
      VAPID_PUBLIC_KEY: k.publicKey,
      VAPID_PRIVATE_KEY: k.privateKey,
    };
    const audience = notifyAudience();
    expect(audience).toHaveLength(2);
    expect(audience[1]).toEqual({ pushSubscriptions: { some: {} } });
    expect(audience[1]).not.toHaveProperty('botBlockedAt');
  });
});
