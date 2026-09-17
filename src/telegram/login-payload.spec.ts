import {
  formatUserCode,
  isLoginPayload,
  loginDeepLink,
  parseLoginCode,
} from './login-payload';

describe('parseLoginCode', () => {
  it('достаёт код из payload входа', () => {
    expect(parseLoginCode('login_K7M2QX94')).toBe('K7M2QX94');
  });

  it('приводит регистр — клиенты мессенджеров правят ссылки', () => {
    expect(parseLoginCode('login_k7m2qx94')).toBe('K7M2QX94');
  });

  it('чужой префикс не подходит, даже если содержит наш', () => {
    // Совпадение подстроки — не проверка имени (инцидент 2026-08-08).
    expect(parseLoginCode('xlogin_K7M2QX94')).toBeNull();
    expect(parseLoginCode('pair_K7M2QX94')).toBeNull();
    expect(parseLoginCode('src_seed1')).toBeNull();
  });

  it('код не той длины или с запрещёнными символами — null, до похода в БД', () => {
    expect(parseLoginCode('login_K7M2QX9')).toBeNull();
    expect(parseLoginCode('login_K7M2QX945')).toBeNull();
    expect(parseLoginCode('login_K7M2QX9O')).toBeNull(); // O похожа на 0
    expect(parseLoginCode('login_K7M2QX9!')).toBeNull();
  });

  it('пустой payload и отсутствие payload не роняют разбор', () => {
    expect(parseLoginCode('login_')).toBeNull();
    expect(parseLoginCode(undefined)).toBeNull();
  });
});

describe('isLoginPayload', () => {
  it('отличает адресованное входу от всего остального', () => {
    expect(isLoginPayload('login_K7M2QX94')).toBe(true);
    // Негодный код — всё ещё вход: человеку надо сказать «код истёк», а не
    // молча показать обычное приветствие.
    expect(isLoginPayload('login_мусор')).toBe(true);
    expect(isLoginPayload('pair_ABC')).toBe(false);
    expect(isLoginPayload(undefined)).toBe(false);
  });
});

describe('loginDeepLink', () => {
  it('ведёт в чат бота, а не в мини-апп — карточку сверки показывает бот', () => {
    expect(loginDeepLink('SchemeHappensBot', 'K7M2QX94')).toBe(
      'https://t.me/SchemeHappensBot?start=login_K7M2QX94',
    );
  });

  it('ссылка разбирается обратно тем же парсером', () => {
    const link = loginDeepLink('Bot', 'K7M2QX94');
    const payload = link.split('?start=')[1];
    expect(parseLoginCode(payload)).toBe('K7M2QX94');
  });
});

describe('formatUserCode', () => {
  it('разбивает код пополам — так его сверяют глазами', () => {
    expect(formatUserCode('K7M2QX94')).toBe('K7M2-QX94');
  });
});
