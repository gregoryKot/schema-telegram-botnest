// @vitest-environment jsdom
// Атрибуция заявки (leadSource.ts): страница + referrer, без PII, срез до
// 200 символов. Ветки: наличие/отсутствие referrer, переполнение лимита,
// вырожденный случай (пустая строка → undefined вместо мусорной строки).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { leadSource } from './leadSource';

function stubLocation(hostname: string, pathname: string, hash: string) {
  vi.stubGlobal('location', { hostname, pathname, hash });
}

function stubReferrer(referrer: string) {
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  stubReferrer('');
});

describe('leadSource', () => {
  it('без referrer — только страница (host + путь + hash)', () => {
    stubLocation('schemehappens.ru', '/booking', '');
    stubReferrer('');
    expect(leadSource()).toBe('schemehappens.ru/booking');
  });

  it('с referrer — «страница ← referrer»', () => {
    stubLocation('schemehappens.ru', '/booking', '#form');
    stubReferrer('https://google.com/search');
    expect(leadSource()).toBe('schemehappens.ru/booking#form ← https://google.com/search');
  });

  it('срезает результат до 200 символов', () => {
    stubLocation('schemehappens.ru', '/' + 'a'.repeat(300), '');
    stubReferrer('');
    const result = leadSource();
    expect(result).toHaveLength(200);
  });

  it('вырожденный случай: пустая итоговая строка — undefined, не мусор', () => {
    stubLocation('', '', '');
    stubReferrer('');
    expect(leadSource()).toBeUndefined();
  });
});
