// @vitest-environment jsdom
// Адрес возврата в ссылке из письма (E14, аудит 2026-11): уходит с запросом
// письма только то, что примет DTO сервера, а приходит назад — через тот же
// safeReturnPath, что и адрес вкладки (не открытый редирект).
import { describe, it, expect, beforeEach } from 'vitest';
import { AUTH_RETURN_KEY, rememberReturnTo } from './returnTo';
import { emailReturnPath, returnToForEmailLink } from './emailReturnTo';

beforeEach(() => sessionStorage.clear());

describe('returnToForEmailLink', () => {
  it('запомненный путь — в запрос письма, вкладка его не теряет', () => {
    rememberReturnTo('/schemas?id=3#top');
    expect(returnToForEmailLink()).toBe('/schemas?id=3#top');
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBe('/schemas?id=3#top');
  });

  it('пусто, длиннее 512 или с `//` в хвосте — не шлём (сервер ответил бы 400)', () => {
    expect(returnToForEmailLink()).toBeUndefined();
    rememberReturnTo(`/${'a'.repeat(512)}`);
    expect(returnToForEmailLink()).toBeUndefined();
    rememberReturnTo('/x?next=https://a.b');
    expect(returnToForEmailLink()).toBeUndefined();
    rememberReturnTo(`/${'a'.repeat(511)}`);
    expect(returnToForEmailLink()).toHaveLength(512);
  });
});

describe('emailReturnPath', () => {
  it('путь из ссылки сильнее адреса вкладки; без него — вкладка', () => {
    expect(emailReturnPath('/diary', '/schemas')).toBe('/diary');
    expect(emailReturnPath(null, '/schemas')).toBe('/schemas');
    expect(emailReturnPath(null, null)).toBeNull();
  });

  it.each(['//evil.com', '/\\evil.com', '/\t/evil.com', '/..//evil.com', 'https://evil.com', 'javascript:alert(1)'])(
    'чужой путь из ссылки (%j) не берётся',
    (raw) => {
      expect(emailReturnPath(raw, null)).toBeNull();
      expect(emailReturnPath(raw, '/schemas')).toBe('/schemas');
    },
  );
});
