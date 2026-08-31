// Кто исчерпал лимит запросов. Регрессия на находку аудита 2026-07 (S-1) и на
// её первую починку.
//
// Находка: бакет строился по НЕВЕРИФИЦИРОВАННОМУ `sub` из JWT (подпись
// проверяет только следующий гард), и ротация фейкового `sub` давала новый
// бакет на каждый запрос — лимита не было. Починка 2026-07 сковала такой
// идентификатор с IP (`uid:<sub>|ip:<ip>`) и объявила обход закрытым.
//
// Он закрыт не был: ключ по-прежнему МЕНЯЛСЯ вместе с `sub`. Тест это
// пропустил, потому что утверждал слабое — что оба ключа кончаются на один
// IP, — вместо главного: что ключ ОДИН И ТОТ ЖЕ. Поэтому ниже сравнение
// именно на равенство, и оно красное на прежнем коде.
//
// Теперь подпись проверяется по-настоящему: сошлась — свой бакет, не сошлась —
// общий бакет адреса, где ротация не даёт ничего.
import { createHmac } from 'crypto';
import { UserThrottlerGuard } from './throttler.guard';

const JWT_SECRET = 'secret-for-tests';
const BOT_TOKEN = '123456:test-bot-token';

// getTracker — protected; для теста открываем через наследника.
class TestableGuard extends UserThrottlerGuard {
  track(req: Record<string, any>): Promise<string> {
    return this.getTracker(req);
  }
}

function jwtWith(
  sub: string,
  secret: string | null,
  over: { type?: string; exp?: number } = {},
): string {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
    'base64url',
  );
  const claims = {
    sub,
    type: over.type ?? 'access',
    exp: over.exp ?? Math.floor(Date.now() / 1000) + 900,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = secret
    ? createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')
    : 'поддельная-подпись';
  return `${head}.${body}.${sig}`;
}

function initDataWith(id: number, token: string | null): string {
  const params = new URLSearchParams({
    auth_date: '1700000000',
    user: JSON.stringify({ id }),
  });
  const checkString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const hash = token
    ? createHmac(
        'sha256',
        createHmac('sha256', 'WebAppData').update(token).digest(),
      )
        .update(checkString)
        .digest('hex')
    : 'ff'.repeat(32);
  params.set('hash', hash);
  return params.toString();
}

describe('UserThrottlerGuard.getTracker', () => {
  // ThrottlerGuard-конструктор в getTracker не участвует — создаём без DI.
  const guard = Object.create(TestableGuard.prototype) as TestableGuard;
  const env = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.BOT_TOKEN = BOT_TOKEN;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('верифицированный userId (после auth-гарда) — чистый uid-бакет', async () => {
    await expect(
      guard.track({ telegramUserId: 42, ip: '1.2.3.4' }),
    ).resolves.toBe('uid:42');
  });

  it('честно подписанный JWT — свой бакет, без привязки к адресу', async () => {
    // Иначе люди за общим NAT делили бы один лимит на всех.
    const req = (ip: string) => ({
      headers: { authorization: `Bearer ${jwtWith('999', JWT_SECRET)}` },
      ip,
    });
    await expect(guard.track(req('1.2.3.4'))).resolves.toBe('uid:999');
    await expect(guard.track(req('5.5.5.5'))).resolves.toBe('uid:999');
  });

  it('ротация подделанного sub с одного адреса даёт ОДИН бакет', async () => {
    // Главный инвариант: не «ключи похожи», а «ключ один и тот же».
    const keys = await Promise.all(
      ['1', '2', '3'].map((sub) =>
        guard.track({
          headers: { authorization: `Bearer ${jwtWith(sub, null)}` },
          ip: '1.2.3.4',
        }),
      ),
    );
    expect(new Set(keys)).toEqual(new Set(['1.2.3.4']));
  });

  it('чужой ключ подписи не принимается за свой', async () => {
    await expect(
      guard.track({
        headers: { authorization: `Bearer ${jwtWith('999', 'другой-ключ')}` },
        ip: '1.2.3.4',
      }),
    ).resolves.toBe('1.2.3.4');
  });

  it('честно подписанный, но ПРОСРОЧЕННЫЙ токен → бакет адреса, не uid', async () => {
    // Разбор 2026-08-31: утёкший исторический токен не должен занимать чужой
    // бакет. exp в прошлом — падаем на IP.
    await expect(
      guard.track({
        headers: {
          authorization: `Bearer ${jwtWith('999', JWT_SECRET, {
            exp: Math.floor(Date.now() / 1000) - 10,
          })}`,
        },
        ip: '1.2.3.4',
      }),
    ).resolves.toBe('1.2.3.4');
  });

  it('токен НЕ типа access (link/merge/refresh) → бакет адреса, не uid', async () => {
    // Тем же JWT_SECRET подписаны и другие виды токенов; для бакета годится
    // только access.
    await expect(
      guard.track({
        headers: {
          authorization: `Bearer ${jwtWith('999', JWT_SECRET, { type: 'link' })}`,
        },
        ip: '1.2.3.4',
      }),
    ).resolves.toBe('1.2.3.4');
  });

  it('честная подпись initData — свой бакет', async () => {
    await expect(
      guard.track({
        headers: { 'x-telegram-init-data': initDataWith(777, BOT_TOKEN) },
        ip: '5.6.7.8',
      }),
    ).resolves.toBe('uid:777');
  });

  it('BOT_TOKEN с пробелом/переносом в env — initData всё равно в свой бакет', async () => {
    // Разбор 2026-08-31: без .trim() пробел в env ронял ВСЕХ мини-апп-юзеров в
    // общий IP-бакет. Telegram подписывает настоящим токеном (без пробела).
    process.env.BOT_TOKEN = `${BOT_TOKEN}\n`;
    await expect(
      guard.track({
        headers: { 'x-telegram-init-data': initDataWith(777, BOT_TOKEN) },
        ip: '5.6.7.8',
      }),
    ).resolves.toBe('uid:777');
  });

  it('подделанная initData падает в бакет адреса', async () => {
    const keys = await Promise.all(
      [777, 778].map((id) =>
        guard.track({
          headers: { 'x-telegram-init-data': initDataWith(id, null) },
          ip: '5.6.7.8',
        }),
      ),
    );
    expect(new Set(keys)).toEqual(new Set(['5.6.7.8']));
  });

  it('секрета в окружении нет — бакет по адресу, а не по слову из токена', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.BOT_TOKEN;
    await expect(
      guard.track({
        headers: { authorization: `Bearer ${jwtWith('999', JWT_SECRET)}` },
        ip: '1.2.3.4',
      }),
    ).resolves.toBe('1.2.3.4');
  });

  it('битый JWT / initData — бакет адреса', async () => {
    await expect(
      guard.track({
        headers: { authorization: 'Bearer not-a-jwt' },
        ip: '9.9.9.9',
      }),
    ).resolves.toBe('9.9.9.9');
    await expect(
      guard.track({
        headers: { 'x-telegram-init-data': 'user=%7Bbroken&hash=zz' },
        ip: '9.9.9.9',
      }),
    ).resolves.toBe('9.9.9.9');
  });

  it('подпись сошлась, а внутри не JSON — бакет адреса', async () => {
    // Свой же ключ можно подписать чем угодно: проверка подписи не обещает,
    // что внутри лежит разбираемый токен.
    const head = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
      'base64url',
    );
    const body = Buffer.from('не-json').toString('base64url');
    const sig = createHmac('sha256', JWT_SECRET)
      .update(`${head}.${body}`)
      .digest('base64url');

    await expect(
      guard.track({
        headers: { authorization: `Bearer ${head}.${body}.${sig}` },
        ip: '1.2.3.4',
      }),
    ).resolves.toBe('1.2.3.4');
  });

  it('заголовок пришёл списком значений — читаем как отсутствующий', async () => {
    // Node складывает повторённый заголовок в массив; принять первый элемент
    // значило бы дать выбирать, какую из двух подписей проверять.
    await expect(
      guard.track({
        headers: {
          authorization: [`Bearer ${jwtWith('999', JWT_SECRET)}`, 'Bearer x'],
        },
        ip: '1.2.3.4',
      }),
    ).resolves.toBe('1.2.3.4');
  });

  it('без кредов и адреса — unknown', async () => {
    await expect(guard.track({ headers: {} })).resolves.toBe('unknown');
  });
});
