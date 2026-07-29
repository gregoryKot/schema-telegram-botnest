// Регрессия инцидента 2026-07-29: в алерт админу приезжало «request to
// https://api.telegram.org/bot…/sendMessage failed, reason:» — и обрывалось.
// Транспортная ошибка node-fetch внутри telegraf кладёт причину не в message,
// а в code/errno/cause, и без неё алерт бесполезен: непонятно, сеть это или
// права бота в канале.
import { describeTelegramError, telegramErrorCode } from './telegram-error';

describe('describeTelegramError', () => {
  it('ответ Telegram API → «код: описание»', () => {
    const err = {
      response: { error_code: 400, description: 'chat not found' },
    };
    expect(describeTelegramError(err)).toBe('400: chat not found');
  });

  it('описание без кода отдаётся как есть', () => {
    expect(
      describeTelegramError({ response: { description: 'forbidden' } }),
    ).toBe('forbidden');
  });

  it('сетевой сбой с пустым текстом → всё равно виден код', () => {
    const err = Object.assign(
      new Error(
        'request to https://api.telegram.org/bot1:X/sendMessage failed, reason: ',
      ),
      { code: 'ETIMEDOUT' },
    );
    expect(describeTelegramError(err)).toContain('ETIMEDOUT');
  });

  it('код из cause (undici) тоже находится', () => {
    const err = Object.assign(new Error('fetch failed'), {
      cause: { code: 'ENOTFOUND' },
    });
    expect(describeTelegramError(err)).toBe('ENOTFOUND (fetch failed)');
  });

  it('errno без code — последний шанс не потерять причину', () => {
    expect(describeTelegramError({ errno: -110 })).toBe('-110');
  });

  it('совсем пустая ошибка не превращается в пустую строку', () => {
    expect(describeTelegramError(undefined)).toBe('неизвестная ошибка');
    expect(describeTelegramError(new Error(''))).toBe('неизвестная ошибка');
  });
});

describe('telegramErrorCode', () => {
  it('достаёт error_code ответа API', () => {
    expect(telegramErrorCode({ response: { error_code: 403 } })).toBe(403);
  });

  it('на транспортной ошибке кода нет', () => {
    expect(telegramErrorCode(new Error('boom'))).toBeUndefined();
  });
});
