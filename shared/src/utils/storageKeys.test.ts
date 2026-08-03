// @vitest-environment jsdom
// shouldShowChildhoodWheel — единственная функция здесь с логикой (ключи
// сами — просто строки-константы). Проверяем чистое/грязное состояние
// localStorage (пустой аккаунт vs уже пройденное «колесо детства»).
import { describe, it, expect, beforeEach } from 'vitest';
import { CHILDHOOD_DONE_KEY, shouldShowChildhoodWheel } from './storageKeys';

beforeEach(() => {
  localStorage.clear();
});

describe('shouldShowChildhoodWheel', () => {
  it('чистый аккаунт (ключа нет) — показывать колесо', () => {
    expect(shouldShowChildhoodWheel()).toBe(true);
  });

  it('после прохождения (ключ проставлен) — не показывать', () => {
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    expect(shouldShowChildhoodWheel()).toBe(false);
  });
});
