// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { markLoginConsentShown, wasLoginConsentShown } from './loginConsent';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('loginConsent', () => {
  it('без отметки экран входа не показывался', () => {
    expect(wasLoginConsentShown()).toBe(false);
  });
  it('после отметки помнит', () => {
    markLoginConsentShown();
    expect(wasLoginConsentShown()).toBe(true);
  });
  it('недоступное хранилище: не бросает, помнит в памяти страницы', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => markLoginConsentShown()).not.toThrow();
    expect(wasLoginConsentShown()).toBe(true);
  });
});
