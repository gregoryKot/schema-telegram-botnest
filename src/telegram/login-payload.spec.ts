import { isLoginPayload, loginClosedText } from './login-payload';

describe('isLoginPayload', () => {
  it('отличает прежнюю ссылку входа от всего остального', () => {
    expect(isLoginPayload('login_K7M2QX94')).toBe(true);
    expect(isLoginPayload('login_мусор')).toBe(true);
    // Совпадение подстроки — не проверка имени (инцидент 2026-08-08).
    expect(isLoginPayload('xlogin_K7M2QX94')).toBe(false);
    expect(isLoginPayload('link_K7M2QX94')).toBe(false);
    expect(isLoginPayload('pair_ABC')).toBe(false);
    expect(isLoginPayload(undefined)).toBe(false);
  });
});

describe('loginClosedText', () => {
  it('в обеих формах говорит, что вход закрыт и чем входить на сайте', () => {
    for (const form of ['ty', 'vy'] as const) {
      const text = loginClosedText(form);
      expect(text).toContain('Вход на сайт через Telegram закрыт');
      expect(text).toContain('почту или VK ID');
    }
    expect(loginClosedText('ty')).toContain('Открой приложение');
    expect(loginClosedText('vy')).toContain('Откройте приложение');
  });
});
