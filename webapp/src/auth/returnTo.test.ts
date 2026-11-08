// @vitest-environment jsdom
// Адрес возврата после входа (аудит 2026-11, E14): только внутренний путь —
// иначе «войди и вернись» становится открытым редиректом; параметр запуска
// сюда не попадает (у него свой механизм со сроком).
import { describe, it, expect, beforeEach } from 'vitest';
import { AUTH_RETURN_KEY, rememberReturnTo, safeReturnPath, takeReturnTo } from './returnTo';

beforeEach(() => sessionStorage.clear());

describe('safeReturnPath', () => {
  it('внутренний путь с query и якорем — как есть', () => {
    expect(safeReturnPath('/diary?tab=schemas')).toBe('/diary?tab=schemas');
    expect(safeReturnPath('/link?code=ABCD2345#x')).toBe('/link?code=ABCD2345#x');
  });

  it.each([
    null, undefined, '', 'diary', 'https://evil.com/x', '//evil.com/x',
    '/\\evil.com', '/\t/evil.com', 'javascript:alert(1)',
  ])('чужое или битое (%j) — null', (raw) => {
    expect(safeReturnPath(raw)).toBeNull();
  });
});

describe('rememberReturnTo / takeReturnTo', () => {
  it('сохранил → забрал один раз', () => {
    rememberReturnTo('/schemas?id=3');
    expect(takeReturnTo()).toBe('/schemas?id=3');
    expect(takeReturnTo()).toBeNull();
  });

  it('параметр запуска срезается, остальной query остаётся', () => {
    rememberReturnTo('/diary?tab=schemas&startapp=therapy_ABC&start_param=x');
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBe('/diary?tab=schemas');
    rememberReturnTo('/today?startapp=tasks');
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBe('/today');
  });

  it('чужой адрес не записывается и не читается, даже если его подложили', () => {
    rememberReturnTo('//evil.com/phish');
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBeNull();
    sessionStorage.setItem(AUTH_RETURN_KEY, '//evil.com/phish');
    expect(takeReturnTo()).toBeNull();
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBeNull();
  });
});
