// Разбор `/start link_<КОД>`. Совпадение подстроки — не проверка имени
// (правило №14): префикс и форма кода сверяются целиком.
import { isLinkPayload, linkDeepLink, parseLinkCode } from './link-payload';
import { parseLoginCode } from './login-payload';

describe('parseLinkCode', () => {
  it('годный код разбирается', () => {
    expect(parseLinkCode('link_ABCD2345')).toBe('ABCD2345');
  });

  it('нижний регистр приводится к верхнему — клиенты «улучшают» ссылки', () => {
    expect(parseLinkCode('link_abcd2345')).toBe('ABCD2345');
  });

  it('чужой префикс не считается совпадением', () => {
    // `xlink_` содержит `link_` подстрокой — и именно так ломался разбор
    // адреса в инциденте 2026-08-08.
    expect(parseLinkCode('xlink_ABCD2345')).toBeNull();
    expect(parseLinkCode('login_ABCD2345')).toBeNull();
    expect(isLinkPayload('xlink_ABCD2345')).toBe(false);
  });

  it('код входа и код привязки разбираются РАЗНЫМИ ветками', () => {
    expect(parseLoginCode('link_ABCD2345')).toBeNull();
    expect(parseLinkCode('login_ABCD2345')).toBeNull();
  });

  it('буквы вне алфавита кода отсекаются (нет 0/O/1/I/L)', () => {
    expect(parseLinkCode('link_ABCD234O')).toBeNull();
    expect(parseLinkCode('link_ABCD2340')).toBeNull();
    expect(parseLinkCode('link_ABC')).toBeNull();
    expect(parseLinkCode('link_')).toBeNull();
  });

  it('не строка — не падаем', () => {
    expect(parseLinkCode(undefined)).toBeNull();
    expect(isLinkPayload(undefined)).toBe(false);
  });
});

describe('linkDeepLink', () => {
  it('ссылка совпадает с той, что строит фронт', () => {
    expect(linkDeepLink('schema_bot', 'ABCD2345')).toBe(
      'https://t.me/schema_bot?start=link_ABCD2345',
    );
  });
});
