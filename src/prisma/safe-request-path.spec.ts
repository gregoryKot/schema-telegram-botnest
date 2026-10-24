// Путь запроса для алерт-канала: query и токены в сегментах пути не доходят
// до лога (аудит 2026-10, D1). Токены ниже — выдуманные, формата настоящих.
import { safeRequestPath } from './safe-request-path';

const UUID = '3f2b8c1e-9a4d-4e7b-8c55-0d1f6a7b9e21';
const B64 = 'Zk3Qp9xLmN2vB7tYhR4sWc8UaE1dGj';

describe('safeRequestPath', () => {
  it('режет query и fragment (?token=, OAuth code/state)', () => {
    expect(safeRequestPath('/api/auth/callback?code=abc&state=xyz#frag')).toBe(
      '/api/auth/callback',
    );
  });

  it.each([
    [`/api/booking/by-token/${UUID}`, '/api/booking/by-token/<token>'],
    [`/api/booking/ics/${B64}`, '/api/booking/ics/<token>'],
    ['/api/booking/cancel/short', '/api/booking/cancel/<token>'],
    [`/api/booking/${B64}/status`, '/api/booking/<token>/status'],
  ])('маскирует токен в пути: %s', (input, expected) => {
    expect(safeRequestPath(input)).toBe(expected);
  });

  it('обычные пути и числовые id не трогает (контрольный случай)', () => {
    expect(safeRequestPath('/api/notes/123')).toBe('/api/notes/123');
    expect(safeRequestPath('/api/articles/kak-ponyat-svoi-potrebnosti')).toBe(
      '/api/articles/kak-ponyat-svoi-potrebnosti',
    );
  });

  it('пусто/undefined → "?"', () => {
    expect(safeRequestPath(undefined)).toBe('?');
    expect(safeRequestPath('')).toBe('?');
  });
});
