// Короткий код сбоя автовхода для экрана (TelegramRetry, слот `code`): тело ответа — только в отчёт.
import { describe, it, expect } from 'vitest';
import { exchangeErrorCode, exchangeErrorLead } from './exchangeError';

describe('exchangeErrorCode', () => {
  it('«Ошибка 401: {json}» → «Ошибка 401»', () => {
    expect(exchangeErrorCode('Ошибка 401: {"message":"Missing authentication","statusCode":401}')).toBe('Ошибка 401');
  });
  it('пустое тело: «Ошибка 403: » и «Ошибка 403» → «Ошибка 403»', () => {
    expect(exchangeErrorCode('Ошибка 403: ')).toBe('Ошибка 403');
    expect(exchangeErrorCode('Ошибка 403')).toBe('Ошибка 403');
  });
  it('строки без кода ответа — как есть', () => {
    expect(exchangeErrorCode('Нет связи с сервером')).toBe('Нет связи с сервером');
    expect(exchangeErrorCode('Не удалось войти (SyntaxError)')).toBe('Не удалось войти (SyntaxError)');
  });
  it('контроль: «Ошибка 4010» не принимается за код ответа', () => {
    expect(exchangeErrorCode('Ошибка 4010 что-то')).toBe('Ошибка 4010 что-то');
  });
});

describe('exchangeErrorLead', () => {
  it('429 и 5xx — человеческий хвост остаётся на экране', () => {
    expect(exchangeErrorLead('Ошибка 429: Слишком много попыток. Подожди минуту.')).toBe('Слишком много попыток. Подожди минуту.');
    expect(exchangeErrorLead('Ошибка 502: Сервер не отвечает')).toBe('Сервер не отвечает');
  });
  it('4xx и строки без кода — лида нет: тело сервера человеку не показываем', () => {
    expect(exchangeErrorLead('Ошибка 401: {"message":"Invalid initData"}')).toBeNull();
    expect(exchangeErrorLead('Нет соединения')).toBeNull();
    expect(exchangeErrorLead('Ошибка 500: ')).toBeNull();
  });
});
