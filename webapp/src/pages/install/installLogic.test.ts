import { describe, expect, it } from 'vitest';
import { isAndroidWebView, loginNote, readHandoffCode } from './installLogic';

const CODE = 'ab12'.repeat(16);

describe('readHandoffCode', () => {
  it('валидный фрагмент', () => {
    expect(readHandoffCode(`#h=${CODE}`)).toBe(CODE);
    expect(readHandoffCode(`#x=1&h=${CODE}`)).toBe(CODE);
    expect(readHandoffCode(`#h=${CODE.toUpperCase()}`)).toBe(CODE);
  });
  it('мусор и чужие параметры — не код', () => {
    expect(readHandoffCode('#h=abc')).toBeNull();
    expect(readHandoffCode(`#h=${CODE}00`)).toBeNull();
    expect(readHandoffCode(`#xh=${CODE}`)).toBeNull();
    expect(readHandoffCode(`#h=${'z'.repeat(64)}`)).toBeNull();
  });
  it('пусто', () => {
    expect(readHandoffCode('')).toBeNull();
    expect(readHandoffCode('#')).toBeNull();
  });
});

describe('isAndroidWebView', () => {
  it('отличает WebView мессенджера от Chrome', () => {
    expect(isAndroidWebView('Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 Version/4.0 Chrome/120 Mobile Safari/537.36')).toBe(true);
    expect(isAndroidWebView('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe(false);
  });
});

describe('loginNote', () => {
  it('iOS — предупреждение о входе в обеих формах, независимо от сессии', () => {
    for (const auth of [true, false]) {
      const n = loginNote('ios', auth);
      expect(n.ty).toContain('войти ещё раз');
      expect(n.ty).toContain('Выбери «Войти через Telegram»');
      expect(n.vy).toContain('Выберите «Войти через Telegram»');
    }
  });
  it('Android и компьютер: вошёл — данные на месте, аноним — вход в приложении', () => {
    expect(loginNote('android', true).vy).toContain('вашими данными');
    expect(loginNote('desktop', true).ty).toContain('твоими данными');
    expect(loginNote('android', false).ty).toContain('Вход — после установки');
  });
});
