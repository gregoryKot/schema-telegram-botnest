// Текст ошибки для экрана (аудит 2026-10, «сырой текст сервера на экранах
// входа»). Тела ответов — настоящие Response, а не объекты-подделки: разбор
// идёт через тот же readErrorBody, что у экранов. Тело 429 — в форме, которую
// отдаёт сервер после починки (src/api/throttler-module-options.spec.ts держит
// её на настоящем гарде), и в старой форме — голая JSON-строка
// «ThrottlerException…»: её отдаёт прод до деплоя и любой клиент со старым кешем.
import { describe, it, expect } from 'vitest';
import {
  humanizeResponseError,
  humanizeThrown,
  isNetworkError,
  readHumanError,
  NO_CONNECTION_TEXT,
  SERVER_DOWN_TEXT,
  TOO_MANY_TEXT,
} from './humanizeError';

const res = (body: string, status: number) => new Response(body, { status });
const FALLBACK = 'Не получилось';

describe('readHumanError — разбор настоящего ответа', () => {
  it('429 с русским текстом сервера — он и показывается', async () => {
    const body = JSON.stringify({
      statusCode: 429,
      message: 'Слишком много попыток подряд. Повторить можно через минуту',
    });
    await expect(readHumanError(res(body, 429), FALLBACK)).resolves.toEqual({
      message: 'Слишком много попыток подряд. Повторить можно через минуту',
    });
  });

  it('429 старой формы (голая строка «ThrottlerException…») — общий текст про лимит', async () => {
    const r = res('"ThrottlerException: Too Many Requests"', 429);
    expect((await readHumanError(r, FALLBACK)).message).toBe(TOO_MANY_TEXT);
  });

  it('429 объектом с английским текстом — тоже общий текст, не fallback экрана', async () => {
    const r = res(
      '{"statusCode":429,"message":"ThrottlerException: Too Many Requests"}',
      429,
    );
    expect((await readHumanError(r, FALLBACK)).message).toBe(TOO_MANY_TEXT);
  });

  it('502 от прокси (HTML) — «сервер не ответил», не fallback экрана', async () => {
    const r = res('<html><body>502 Bad Gateway</body></html>', 502);
    expect((await readHumanError(r, 'Неверный код')).message).toBe(
      SERVER_DOWN_TEXT,
    );
  });

  it('500 с русским текстом сервера — он и показывается', async () => {
    const r = res(
      '{"statusCode":500,"message":"Внутренняя ошибка сервера"}',
      500,
    );
    expect((await readHumanError(r, FALLBACK)).message).toBe(
      'Внутренняя ошибка сервера',
    );
  });

  it('400 с русским текстом сервера — как есть (текст пишут для человека)', async () => {
    const r = res(
      '{"statusCode":400,"message":"Код не найден или истёк"}',
      400,
    );
    expect((await readHumanError(r, FALLBACK)).message).toBe(
      'Код не найден или истёк',
    );
  });

  it('401 со служебным английским (src/auth/auth-2fa.controller.ts) — fallback экрана', async () => {
    const r = res(
      '{"statusCode":401,"message":"Invalid 2FA code","error":"Unauthorized"}',
      401,
    );
    expect((await readHumanError(r, 'Неверный код')).message).toBe(
      'Неверный код',
    );
  });

  it('400 ValidationPipe (массив английских строк) — fallback экрана', async () => {
    const r = res(
      '{"statusCode":400,"message":["email must be an email"]}',
      400,
    );
    expect((await readHumanError(r, FALLBACK)).message).toBe(FALLBACK);
  });

  it('reason сервера сохраняется рядом с текстом', async () => {
    const r = res(
      '{"message":"Source account requires 2FA","reason":"source_totp_required"}',
      403,
    );
    await expect(readHumanError(r, FALLBACK)).resolves.toEqual({
      message: FALLBACK,
      reason: 'source_totp_required',
    });
  });
});

describe('humanizeResponseError', () => {
  it('русский текст с латиницей внутри (адрес, «2FA») — человеческий', () => {
    expect(
      humanizeResponseError(409, 'Адрес a@b.ru уже привязан', FALLBACK),
    ).toBe('Адрес a@b.ru уже привязан');
  });

  it('нет текста: 4xx — fallback, 5xx — «сервер не ответил», 429 — лимит', () => {
    expect(humanizeResponseError(404, undefined, FALLBACK)).toBe(FALLBACK);
    expect(humanizeResponseError(503, undefined, FALLBACK)).toBe(
      SERVER_DOWN_TEXT,
    );
    expect(humanizeResponseError(429, '', FALLBACK)).toBe(TOO_MANY_TEXT);
  });
});

describe('humanizeThrown', () => {
  it.each([
    ['Chrome', 'Failed to fetch'],
    ['Safari', 'Load failed'],
    ['Firefox', 'NetworkError when attempting to fetch resource.'],
  ])('обрыв сети (%s) — «нет связи с сервером»', (_engine, text) => {
    expect(humanizeThrown(new TypeError(text), FALLBACK)).toBe(
      NO_CONNECTION_TEXT,
    );
  });

  it('TypeError из кода — не «нет связи», а fallback экрана', () => {
    const bug = new TypeError(
      "Cannot read properties of undefined (reading 'x')",
    );
    expect(isNetworkError(bug)).toBe(false);
    expect(humanizeThrown(bug, FALLBACK)).toBe(FALLBACK);
  });

  it('Error с русским текстом (уже очеловеченный ответ) — как есть', () => {
    expect(humanizeThrown(new Error('Неверный код'), FALLBACK)).toBe(
      'Неверный код',
    );
  });

  it('Error с английским текстом и не-Error — fallback', () => {
    expect(humanizeThrown(new Error('Merge failed'), FALLBACK)).toBe(FALLBACK);
    expect(
      humanizeThrown(new SyntaxError('Unexpected token <'), FALLBACK),
    ).toBe(FALLBACK);
    expect(humanizeThrown('строка', FALLBACK)).toBe(FALLBACK);
    expect(humanizeThrown(undefined, FALLBACK)).toBe(FALLBACK);
  });
});
