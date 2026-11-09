// Причина сбоя в отчёте о поломке: тип и статус из закрытого списка, текст
// исключения не уходит никогда (инвариант H0/H6 client-errors.controller.ts).
import { describe, it, expect } from 'vitest';
import { describeFailure } from './describeFailure';
import { readJsonBody } from './readJsonBody';

class StatusError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

describe('describeFailure', () => {
  it('ответ сервера — код ответа полем status (ApiError сайта, HttpStatusError)', () => {
    expect(describeFailure(new StatusError(429, 'Too Many Requests'))).toBe(
      'HTTP 429',
    );
    expect(describeFailure(new StatusError(503, 'Service Unavailable'))).toBe(
      'HTTP 503',
    );
  });

  it('статус вне диапазона HTTP не выдаётся за код ответа', () => {
    expect(describeFailure(new StatusError(0, 'x'))).toBe('Error');
    expect(describeFailure(new StatusError(1e6, 'x'))).toBe('Error');
  });

  it('обрыв сети — network (тексты движков Chrome, Safari, Firefox)', () => {
    expect(describeFailure(new TypeError('Failed to fetch'))).toBe('network');
    expect(describeFailure(new TypeError('Load failed'))).toBe('network');
    expect(
      describeFailure(
        new TypeError('NetworkError when attempting to fetch resource.'),
      ),
    ).toBe('network');
  });

  it('таймаут запроса (AbortController) — timeout', () => {
    expect(
      describeFailure(
        new DOMException('The operation was aborted.', 'AbortError'),
      ),
    ).toBe('timeout');
    expect(
      describeFailure({ name: 'TimeoutError', message: 'signal timed out' }),
    ).toBe('timeout');
  });

  it('битое тело успешного ответа — parse (настоящий разбор, а не подделка)', async () => {
    const err = await readJsonBody(
      new Response('<html>502 Bad Gateway</html>'),
    ).catch((e: unknown) => e);
    expect(describeFailure(err)).toBe('parse');
  });

  it('прочая ошибка — имя класса; ошибка кода (TypeError не про сеть) отличима от обрыва', () => {
    expect(
      describeFailure(
        new TypeError("Cannot read properties of undefined (reading 'x')"),
      ),
    ).toBe('TypeError');
    expect(describeFailure(new RangeError('bad'))).toBe('RangeError');
    expect(describeFailure(new Error('boom'))).toBe('Error');
  });

  it('брошенная строка и прочее не-Error — non-error, без содержимого', () => {
    expect(describeFailure('fetch /auth#access_token=СЕКРЕТ')).toBe(
      'non-error',
    );
    expect(describeFailure(undefined)).toBe('non-error');
    expect(describeFailure(null)).toBe('non-error');
  });

  it('текст исключения, адрес с токеном и код входа в причину не попадают', () => {
    const leaks = [
      new Error('fetch failed: /auth#access_token=СЕКРЕТ'),
      new StatusError(401, 'Код 2FA 123456 не подошёл'),
      new TypeError('Failed to fetch https://x/api?token=СЕКРЕТ'),
      Object.assign(new Error('x'), {
        name: 'Bad name with #access_token=СЕКРЕТ',
      }),
    ];
    for (const err of leaks) {
      const out = describeFailure(err);
      expect(out).not.toContain('СЕКРЕТ');
      expect(out).not.toContain('123456');
      expect(out).toMatch(
        /^(HTTP \d{3}|network|timeout|parse|non-error|[A-Za-z]{1,40})$/,
      );
    }
  });
});
