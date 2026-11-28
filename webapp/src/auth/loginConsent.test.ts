// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rememberLoginConsent, forgetLoginConsent, takeLoginConsent } from './loginConsent';

beforeEach(() => {
  forgetLoginConsent();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('loginConsent', () => {
  it('без отметки читать нечего', () => {
    expect(takeLoginConsent()).toBeNull();
  });
  it('take отдаёт редакцию один раз и удаляет отметку', () => {
    rememberLoginConsent('2026-11-27');
    expect(takeLoginConsent()).toBe('2026-11-27');
    expect(takeLoginConsent()).toBeNull();
    expect(localStorage.getItem('login_consent_given')).toBeNull();
  });
  it('forget снимает отметку (галочку сняли или вход открыт заново)', () => {
    rememberLoginConsent('2026-11-27');
    forgetLoginConsent();
    expect(takeLoginConsent()).toBeNull();
  });
  it('недоступное хранилище: не бросает, помнит в памяти страницы', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => rememberLoginConsent('2026-11-27')).not.toThrow();
    expect(takeLoginConsent()).toBe('2026-11-27');
    expect(takeLoginConsent()).toBeNull();
  });
});
