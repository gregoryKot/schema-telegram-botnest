// url.ts — normalizeBaseUrl: APP_URL из env может быть задан как угодно
// (голый домен, с/без схемы, с хвостовым слэшем). От этого зависит, будут
// ли рабочими inline-кнопки Telegram (BUTTON_URL_INVALID при кривом URL)
// и ReturnURL Robokassa.
import { normalizeBaseUrl } from './url';

describe('normalizeBaseUrl', () => {
  it('undefined → используется fallback со схемой https', () => {
    expect(normalizeBaseUrl(undefined, 'schemehappens.ru')).toBe(
      'https://schemehappens.ru',
    );
  });

  it('пустая строка → fallback', () => {
    expect(normalizeBaseUrl('', 'schemehappens.ru')).toBe(
      'https://schemehappens.ru',
    );
  });

  it('строка из одних пробелов → fallback (trim делает её пустой)', () => {
    expect(normalizeBaseUrl('   ', 'schemehappens.ru')).toBe(
      'https://schemehappens.ru',
    );
  });

  it('голый домен без схемы → добавляется https://', () => {
    expect(normalizeBaseUrl('schemehappens.ru', 'fallback.ru')).toBe(
      'https://schemehappens.ru',
    );
  });

  it('уже с https:// → схема не дублируется', () => {
    expect(normalizeBaseUrl('https://schemehappens.ru', 'fallback.ru')).toBe(
      'https://schemehappens.ru',
    );
  });

  it('с http:// → схема НЕ приводится к https, остаётся как задано', () => {
    expect(normalizeBaseUrl('http://schemehappens.ru', 'fallback.ru')).toBe(
      'http://schemehappens.ru',
    );
  });

  it('схема регистронезависима (HTTPS://) — считается уже заданной, не дублируется', () => {
    expect(normalizeBaseUrl('HTTPS://Example.com', 'fallback.ru')).toBe(
      'HTTPS://Example.com',
    );
  });

  it('хвостовой слэш обрезается', () => {
    expect(normalizeBaseUrl('schemehappens.ru/', 'fallback.ru')).toBe(
      'https://schemehappens.ru',
    );
  });

  it('двойной хвостовой слэш — обрезается только один (regex $ не global)', () => {
    expect(normalizeBaseUrl('https://x.com//', 'fallback.ru')).toBe(
      'https://x.com/',
    );
  });

  it('пробелы вокруг значения обрезаются перед проверкой схемы', () => {
    expect(normalizeBaseUrl('  schemehappens.ru  ', 'fallback.ru')).toBe(
      'https://schemehappens.ru',
    );
  });

  it('домен с путём сохраняется как есть (кроме хвостового слэша)', () => {
    expect(normalizeBaseUrl('schemehappens.ru/app', 'fallback.ru')).toBe(
      'https://schemehappens.ru/app',
    );
  });
});
