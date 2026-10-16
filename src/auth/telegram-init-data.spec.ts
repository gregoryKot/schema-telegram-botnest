// Единый верификатор подписи initData мини-аппа Telegram (аудит 2026-10:
// подпись проверяли три реализации с разным порядком проверок и сравнением).
// Подпись в тесте считается независимо, по спеке Telegram: ключ —
// HMAC-SHA256(key="WebAppData", botToken), им подписана строка полей.
import { createHmac, timingSafeEqual } from 'crypto';
import {
  INIT_DATA_EXPIRED_MESSAGE,
  readTelegramUser,
  verifyTelegramInitData,
  verifyTelegramInitDataSignature,
} from './telegram-init-data';
import { INIT_DATA_MAX_AGE_S } from '../api/init-data-window';
import { classifyInitDataFailure } from '../api/initdata-alert';

// ESM-экспорт crypto не перехватить spyOn'ом — оборачиваем модуль целиком.
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return { ...actual, timingSafeEqual: jest.fn(actual.timingSafeEqual) };
});

const TOKEN = '12345:TEST_TOKEN';
const NOW_MS = 1_800_000_000_000;
const NOW_S = NOW_MS / 1000;

function sign(fields: Record<string, string>, token = TOKEN): string {
  const checkString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const base = (over: Record<string, string> = {}) => ({
  auth_date: String(NOW_S),
  query_id: 'AAE_test',
  user: JSON.stringify({ id: 42, first_name: 'Грег' }),
  ...over,
});

function withHash(initData: string, hash: string): string {
  const p = new URLSearchParams(initData);
  p.set('hash', hash);
  return p.toString();
}

describe('verifyTelegramInitData', () => {
  it('честная подпись → пользователь и дата', () => {
    expect(verifyTelegramInitData(sign(base()), TOKEN, NOW_MS)).toEqual({
      user: { id: 42, first_name: 'Грег' },
      authDate: NOW_S,
    });
  });

  it('токен с пробелом/переносом из env подписывает так же, как чистый', () => {
    expect(
      verifyTelegramInitData(sign(base()), ` ${TOKEN}\n`, NOW_MS).user.id,
    ).toBe(42);
  });

  it('подпись чужим токеном → ошибка подписи', () => {
    const forged = sign(base(), '999:OTHER');
    expect(() => verifyTelegramInitData(forged, TOKEN, NOW_MS)).toThrow(
      'Invalid Telegram WebApp signature',
    );
  });

  it('подпись сверяется через crypto.timingSafeEqual, а не оператором ===', () => {
    const spy = timingSafeEqual as jest.MockedFunction<typeof timingSafeEqual>;
    spy.mockClear();
    verifyTelegramInitData(sign(base()), TOKEN, NOW_MS);
    expect(spy).toHaveBeenCalledTimes(1);
    const [given, expected] = spy.mock.calls[0] as [Buffer, Buffer];
    expect(given).toHaveLength(32);
    expect(expected).toHaveLength(32);
  });

  it('подмена любого подписанного поля ломает подпись', () => {
    const p = new URLSearchParams(sign(base()));
    p.set('user', JSON.stringify({ id: 43 }));
    expect(() => verifyTelegramInitData(p.toString(), TOKEN, NOW_MS)).toThrow(
      'Invalid Telegram WebApp signature',
    );
  });

  it('hash в верхнем регистре — та же подпись', () => {
    const ok = sign(base());
    const hash = new URLSearchParams(ok).get('hash') as string;
    expect(
      verifyTelegramInitData(withHash(ok, hash.toUpperCase()), TOKEN, NOW_MS)
        .user.id,
    ).toBe(42);
  });

  it.each([
    ['посторонний префикс', (h: string) => 'zz' + h],
    ['посторонний суффикс', (h: string) => h + 'zz'],
    ['короткий', (h: string) => h.slice(0, 62)],
    ['не hex', () => 'g'.repeat(64)],
  ])('hash: %s → Malformed (не RangeError из timingSafeEqual)', (_n, mut) => {
    const ok = sign(base());
    const hash = new URLSearchParams(ok).get('hash') as string;
    expect(() =>
      verifyTelegramInitData(withHash(ok, mut(hash)), TOKEN, NOW_MS),
    ).toThrow('Malformed hash in initData');
  });

  it('нет hash или он повторён → Missing hash', () => {
    const ok = sign(base());
    const hash = new URLSearchParams(ok).get('hash') as string;
    expect(() =>
      verifyTelegramInitData(new URLSearchParams(base()).toString(), TOKEN),
    ).toThrow('Missing hash in initData');
    expect(() =>
      verifyTelegramInitData(`${ok}&hash=${hash}`, TOKEN, NOW_MS),
    ).toThrow('Missing hash in initData');
  });

  it('«+» и %20 в user читаются как у Telegram и подпись сходится', () => {
    const user = JSON.stringify({ id: 7, first_name: 'Анна Мария+2' });
    // URLSearchParams кодирует пробел как «+», а «+» как %2B; клиенты
    // присылают и %20 — после разбора строки должны совпасть.
    const plus = sign(base({ user }));
    const percent = plus.replace(/\+/g, '%20');
    for (const raw of [plus, percent]) {
      expect(verifyTelegramInitData(raw, TOKEN, NOW_MS).user).toEqual({
        id: 7,
        first_name: 'Анна Мария+2',
      });
    }
  });

  it('порядок полей в строке не важен, сортировка — по кодам символов', () => {
    const fields = { ...base(), 'a-b': '1', a: '2', Z: '3', user_x: '4' };
    const raw = sign(fields);
    const shuffled = new URLSearchParams(
      [...new URLSearchParams(raw).entries()].reverse(),
    ).toString();
    expect(verifyTelegramInitData(shuffled, TOKEN, NOW_MS).user.id).toBe(42);
  });
});

describe('окно свежести и порядок «подпись → срок»', () => {
  const at = (ageS: number) => sign(base({ auth_date: String(NOW_S - ageS) }));

  it('ровно INIT_DATA_MAX_AGE_S — принято, на секунду старше — просрочено', () => {
    expect(
      verifyTelegramInitData(at(INIT_DATA_MAX_AGE_S), TOKEN, NOW_MS).user.id,
    ).toBe(42);
    expect(() =>
      verifyTelegramInitData(at(INIT_DATA_MAX_AGE_S + 1), TOKEN, NOW_MS),
    ).toThrow(INIT_DATA_EXPIRED_MESSAGE);
  });

  it('просрочка классифицируется как expired (без алерта админу)', () => {
    let caught: unknown;
    try {
      verifyTelegramInitData(at(INIT_DATA_MAX_AGE_S + 1), TOKEN, NOW_MS);
    } catch (e) {
      caught = e;
    }
    expect(classifyInitDataFailure(caught)).toBe('expired');
  });

  it('поддельная, но СТАРАЯ initData — ошибка подписи, а не «просрочена»', () => {
    // Раньше гард (tma.js) проверял срок первым: старая подделка тихо
    // уходила в expired и не будила админа.
    const forged = withHash(at(INIT_DATA_MAX_AGE_S * 10), 'a'.repeat(64));
    let caught: unknown;
    try {
      verifyTelegramInitData(forged, TOKEN, NOW_MS);
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe('Invalid Telegram WebApp signature');
    expect(classifyInitDataFailure(caught)).toBe('suspicious');
  });

  it.each([
    ['нет auth_date', undefined],
    ['не число', 'вчера'],
    ['ноль', '0'],
    ['отрицательное', '-5'],
    ['дробное', '1.5e9'],
  ])('auth_date: %s — ошибка формата, а не просрочка', (_n, value) => {
    const fields: Record<string, string> = base();
    if (value === undefined) delete fields.auth_date;
    else fields.auth_date = value;
    let caught: unknown;
    try {
      verifyTelegramInitData(sign(fields), TOKEN, NOW_MS);
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe('Invalid auth_date in initData');
    expect(classifyInitDataFailure(caught)).toBe('suspicious');
  });

  it('дата из будущего (часы клиента впереди) не считается просрочкой', () => {
    const future = sign(base({ auth_date: String(NOW_S + 120) }));
    expect(verifyTelegramInitData(future, TOKEN, NOW_MS).user.id).toBe(42);
  });
});

describe('verifyTelegramInitDataSignature / readTelegramUser', () => {
  it('подпись без user проходит (user читается отдельно), readTelegramUser — нет', () => {
    const fields = base();
    delete (fields as Record<string, string | undefined>).user;
    const { params } = verifyTelegramInitDataSignature(
      sign(fields),
      TOKEN,
      NOW_MS,
    );
    expect(() => readTelegramUser(params)).toThrow('Missing user in initData');
  });

  it.each([
    ['не JSON', '{oops', 'Invalid user JSON in initData'],
    ['null', 'null', 'Missing user id in initData'],
    ['id строкой', '{"id":"5"}', 'Missing user id in initData'],
    ['id нулём', '{"id":0}', 'Missing user id in initData'],
    ['без id', '{"first_name":"A"}', 'Missing user id in initData'],
  ])('user %s → ошибка', (_n, raw, message) => {
    expect(() => readTelegramUser(new URLSearchParams({ user: raw }))).toThrow(
      message,
    );
  });

  it('first_name не строкой отбрасывается', () => {
    expect(
      readTelegramUser(
        new URLSearchParams({ user: '{"id":5,"first_name":9}' }),
      ),
    ).toEqual({ id: 5 });
  });
});
