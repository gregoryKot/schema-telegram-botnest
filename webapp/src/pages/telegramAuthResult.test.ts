// Чистая логика разбора возврата с oauth.telegram.org — без React, без jsdom.
// Симптом 2026-08-21: «первый вход падал, второй проходил» — тесты покрывают
// все три формата возврата и UTF-8 в base64url (кириллица в first_name).
import { describe, it, expect } from 'vitest';
import { parseTelegramAuthResult } from './telegramAuthResult';

// btoa(JSON.stringify(...)) бросает на кириллице ("InvalidCharacterError" —
// btoa понимает только Latin1), поэтому существующий тест-хелпер
// TelegramWidgetCallback.test.tsx (b64url через btoa) для кириллицы не годится.
// Строим base64url так же, как это делает настоящий Telegram: UTF-8 байты →
// base64. TextEncoder даёт байты, дальше собираем строку из code units и
// зовём btoa (btoa требует ровно code-unit-на-байт вход — это условие
// выполнено, потому что байты уже готовы).
function b64urlUtf8(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('parseTelegramAuthResult — hash-фрагмент (обычно повторный вход)', () => {
  it('#tgAuthResult=... декодируется в плоские поля', () => {
    const result = parseTelegramAuthResult(
      `#tgAuthResult=${b64urlUtf8({ id: 1, first_name: 'A', hash: 'x' })}`,
      '',
    );
    expect(result).toEqual({ kind: 'ok', fields: { id: '1', first_name: 'A', hash: 'x' } });
  });

  it('работает и без ведущего # (уже отрезан вызывающим кодом)', () => {
    const result = parseTelegramAuthResult(
      `tgAuthResult=${b64urlUtf8({ id: 1, hash: 'x' })}`,
      '',
    );
    expect(result.kind).toBe('ok');
  });
});

describe('parseTelegramAuthResult — query-параметр tgAuthResult (иногда первый вход)', () => {
  it('?tgAuthResult=... в query декодируется так же, как в hash — баг 2026-08-21', () => {
    const result = parseTelegramAuthResult(
      '',
      `?tgAuthResult=${b64urlUtf8({ id: 1, hash: 'x' })}`,
    );
    expect(result).toEqual({ kind: 'ok', fields: { id: '1', hash: 'x' } });
  });

  it('hash и query одновременно — hash в приоритете (первым читает вызывающий код)', () => {
    const result = parseTelegramAuthResult(
      `#tgAuthResult=${b64urlUtf8({ id: 1, hash: 'from-hash' })}`,
      `?tgAuthResult=${b64urlUtf8({ id: 2, hash: 'from-query' })}`,
    );
    expect(result).toEqual({ kind: 'ok', fields: { id: '1', hash: 'from-hash' } });
  });
});

describe('parseTelegramAuthResult — плоский query ?id=...&hash=... (обычно первый вход)', () => {
  it('id+hash напрямую в query используются как payload без обёртки', () => {
    const result = parseTelegramAuthResult('', '?id=555&hash=deadbeef&first_name=%D0%93%D1%80%D0%B8%D0%B3%D0%BE%D1%80%D0%B8%D0%B9');
    expect(result).toEqual({
      kind: 'ok',
      fields: { id: '555', hash: 'deadbeef', first_name: 'Григорий' },
    });
  });

  it('только id без hash — это НЕ считается валидными данными Telegram (false positive guard)', () => {
    const result = parseTelegramAuthResult('', '?id=555&utm_source=x');
    expect(result).toEqual({ kind: 'none' });
  });
});

describe('parseTelegramAuthResult — нет данных ни в одном формате', () => {
  it('пустые hash и search → kind=none', () => {
    expect(parseTelegramAuthResult('', '')).toEqual({ kind: 'none' });
  });
});

describe('parseTelegramAuthResult — битые данные', () => {
  it('нечитаемый base64/JSON в tgAuthResult → kind=error, не бросает исключение', () => {
    const result = parseTelegramAuthResult('#tgAuthResult=not-valid-base64!!!', '');
    expect(result).toEqual({ kind: 'error' });
  });
});

describe('parseTelegramAuthResult — UTF-8 в base64url (кириллица)', () => {
  it('кириллическое first_name декодируется корректно, а не в мусор', () => {
    const result = parseTelegramAuthResult(
      `#tgAuthResult=${b64urlUtf8({ id: 1, first_name: 'Григорий', last_name: 'Котляревский', hash: 'x' })}`,
      '',
    );
    expect(result).toEqual({
      kind: 'ok',
      fields: { id: '1', first_name: 'Григорий', last_name: 'Котляревский', hash: 'x' },
    });
  });

  it('регрессия: наивный atob() без TextDecoder дал бы мусор вместо кириллицы (контрольная проверка хелпера)', () => {
    const encoded = b64urlUtf8({ first_name: 'Григорий' });
    const naive = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))) as { first_name: string };
    expect(naive.first_name).not.toBe('Григорий');
  });
});
