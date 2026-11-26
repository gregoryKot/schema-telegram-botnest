// Проба бота MAX (шапка probe-max.ts): тот же токен подписывает вход в кабинет
// внутри MAX, неверный даёт массовые 401, похожие на атаку.
import { readFileSync } from 'fs';
import { join } from 'path';
import { MAX_TOKEN_ENVS, MaxFetch, judgeMaxMe, maxProbe } from './probe-max';

const status = (code: number): jest.MockedFunction<MaxFetch> =>
  jest.fn().mockResolvedValue({ status: code });

describe('maxProbe', () => {
  it('200 на /me — зелёная, в detail имя переменной, а не токен', async () => {
    const fetchFn = status(200);
    const res = await maxProbe(
      { HEALTHY_ADULT_MAX_TOKEN: ' tok-123 ' },
      fetchFn,
    ).run();
    expect(res).toEqual({
      ok: true,
      detail: 'бот MAX отвечает (токен из HEALTHY_ADULT_MAX_TOKEN)',
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://platform-api2.max.ru/me');
    expect(init.headers).toEqual({ authorization: 'tok-123' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(res.detail).not.toContain('tok-123');
  });

  it('401 — красная: токен не принят, вход в MAX отвечает 401 всем', async () => {
    const res = await maxProbe({ MAX_BOT_TOKEN: 'bad' }, status(401)).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain(
      'MAX не принял токен из MAX_BOT_TOKEN (HTTP 401)',
    );
    expect(res.detail).not.toContain('bad');
  });

  it('таймаут — красная с понятной причиной, не бросает', async () => {
    const timeout = Object.assign(new Error('The operation was aborted'), {
      name: 'TimeoutError',
    });
    const fetchFn: MaxFetch = jest.fn().mockRejectedValue(timeout);
    await expect(
      maxProbe({ MAX_BOT_TOKEN: 't' }, fetchFn).run(),
    ).resolves.toEqual({ ok: false, detail: 'MAX не ответил: таймаут 8 с' });
  });

  it('сбой сети или сертификата — красная с текстом ошибки', async () => {
    const fetchFn: MaxFetch = jest
      .fn()
      .mockRejectedValue(new Error('unable to verify the first certificate'));
    const res = await maxProbe({ MAX_BOT_TOKEN: 't' }, fetchFn).run();
    expect(res).toEqual({
      ok: false,
      detail: 'MAX не ответил: unable to verify the first certificate',
    });
  });

  it('без токена — «не настроено», не красная, в сеть не ходит', async () => {
    const fetchFn = status(200);
    expect(await maxProbe({ MAX_BOT_TOKEN: '  ' }, fetchFn).run()).toEqual({
      ok: true,
      detail: 'не настроено',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('оба токена заданы — проверяется тот, которым подписан вход (MAX_BOT_TOKEN)', async () => {
    const fetchFn = status(200);
    await maxProbe(
      { MAX_BOT_TOKEN: 'login', HEALTHY_ADULT_MAX_TOKEN: 'channel' },
      fetchFn,
    ).run();
    expect(fetchFn.mock.calls[0][1].headers).toEqual({
      authorization: 'login',
    });
  });

  it('живой внешний запрос: повтор после вспышки связи, в /health не идёт', () => {
    expect(maxProbe({})).toMatchObject({
      id: 'max',
      retryOnce: true,
      reportInHealth: false,
    });
  });
});

describe('judgeMaxMe', () => {
  it('прочий статус — красная со статусом, без совета про токен', () => {
    const res = judgeMaxMe(502, 'MAX_BOT_TOKEN');
    expect(res).toEqual({ ok: false, detail: 'MAX ответил HTTP 502 на /me' });
  });
});

// Правило №4: проба обязана проверять тот же токен, что вход. Список входа не
// экспортируется (src/auth — чужая зона правки) — сверка по исходнику.
describe('порядок токенов совпадает со входом из MAX', () => {
  it('MAX_TOKEN_ENVS = TOKEN_ENVS в src/auth/providers/max.provider.ts', () => {
    const src = readFileSync(
      join(__dirname, '../../auth/providers/max.provider.ts'),
      'utf8',
    );
    const m = /const TOKEN_ENVS = \[([^\]]*)\]/.exec(src);
    expect(m).not.toBeNull();
    const login = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(MAX_TOKEN_ENVS).toEqual(login);
  });
});
