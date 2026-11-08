// Состояние VAPID-ключей (push-config.ts): без пары — выключено, половина
// пары или битые ключи — «сломано» с причиной, иначе — готово.
import { generateVAPIDKeys } from 'web-push';
import {
  DEFAULT_VAPID_SUBJECT,
  pushReady,
  readVapid,
  vapidState,
} from './push-config';

const keys = generateVAPIDKeys();

describe('readVapid', () => {
  it('ключей нет — выключено, не авария', () => {
    expect(readVapid({})).toEqual({ kind: 'off' });
    expect(
      readVapid({ VAPID_PUBLIC_KEY: '  ', VAPID_PRIVATE_KEY: '' }),
    ).toEqual({ kind: 'off' });
  });

  it('половина пары — сломано, причина называет недостающий', () => {
    const only = readVapid({ VAPID_PUBLIC_KEY: keys.publicKey });
    expect(only).toEqual({
      kind: 'broken',
      problem: expect.stringContaining('VAPID_PRIVATE_KEY'),
    });
    const other = readVapid({ VAPID_PRIVATE_KEY: keys.privateKey });
    expect(other).toEqual({
      kind: 'broken',
      problem: expect.stringContaining('VAPID_PUBLIC_KEY'),
    });
  });

  it('пара верна — готово, контакт по умолчанию — адрес сайта', () => {
    expect(
      readVapid({
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
      }),
    ).toEqual({
      kind: 'ready',
      config: { ...keys, subject: DEFAULT_VAPID_SUBJECT },
    });
  });

  it('битый ключ или контакт не адрес — сломано', () => {
    expect(
      readVapid({
        VAPID_PUBLIC_KEY: 'short',
        VAPID_PRIVATE_KEY: keys.privateKey,
      }).kind,
    ).toBe('broken');
    expect(readVapid({ ...pair(), VAPID_SUBJECT: 'просто текст' }).kind).toBe(
      'broken',
    );
  });

  it('pushReady / vapidState следуют за значениями env', () => {
    expect(pushReady({})).toBe(false);
    expect(pushReady(pair())).toBe(true);
    expect(vapidState(pair())).toBe(vapidState(pair())); // та же запись, без пересчёта
    expect(pushReady({ VAPID_PUBLIC_KEY: keys.publicKey })).toBe(false);
  });
});

function pair() {
  return {
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  };
}
