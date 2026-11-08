// Ссылка из письма несёт билет входа и адрес возврата (E14, аудит 2026-11):
// письмо открывают новой вкладкой, где sessionStorage сайта пуст. Адрес —
// только свой путь, иначе вход по ссылке стал бы открытым редиректом.
import { emailLinkQuery, safeReturnTo } from './email-link-params';

describe('safeReturnTo', () => {
  it.each(['/diary?tab=schemas', '/link?code=ABCD2345#x', '/', '/app/today'])(
    'свой путь (%s) — как есть',
    (raw) => expect(safeReturnTo(raw)).toBe(raw),
  );

  it.each([
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    'https://evil.com/x',
    'javascript:alert(1)',
    '/..//evil.com',
    '/a b',
    '',
    `/${'a'.repeat(512)}`,
    123,
    ['/a'],
    null,
  ])('чужое или битое (%j) — undefined', (raw) => {
    expect(safeReturnTo(raw)).toBeUndefined();
  });

  it('граница длины: 512 символов проходит', () => {
    expect(safeReturnTo(`/${'a'.repeat(511)}`)).toHaveLength(512);
  });
});

describe('emailLinkQuery', () => {
  it('токен, билет и адрес возврата — закодированными параметрами', () => {
    const q = new URLSearchParams(
      emailLinkQuery('tok_-1', { ticket: 'K7M2QX94', returnTo: '/x?a=1&b=2' }),
    );
    expect(Object.fromEntries(q)).toEqual({
      token: 'tok_-1',
      ticket: 'K7M2QX94',
      return_to: '/x?a=1&b=2',
    });
  });

  it('без доп. параметров — только токен; чужой адрес возврата не попадает в письмо', () => {
    expect(emailLinkQuery('t', {})).toBe('token=t');
    expect(emailLinkQuery('t', { returnTo: '//evil.com' })).toBe('token=t');
  });
});
