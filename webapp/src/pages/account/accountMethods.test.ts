import { describe, it, expect } from 'vitest';
import { accountInitials, countMethods } from './accountMethods';
import type { AccountProvider } from './ProviderRows';

const p = (provider: AccountProvider['provider'], displayName: string | null = null, email: string | null = null): AccountProvider => ({ provider, displayName, email });

describe('countMethods', () => {
  it('чистый аккаунт — 0 из 4 (MAX без привязки не считается)', () => {
    expect(countMethods([])).toEqual({ linked: 0, total: 4 });
  });
  it('считает привязанные', () => {
    expect(countMethods([p('google'), p('email')])).toEqual({ linked: 2, total: 4 });
  });
  it('привязанный MAX добавляет строку', () => {
    expect(countMethods([p('google'), p('max')])).toEqual({ linked: 2, total: 5 });
  });
});

describe('accountInitials', () => {
  it('нет данных — null', () => {
    expect(accountInitials([])).toBeNull();
    expect(accountInitials([p('google')])).toBeNull();
  });
  it('два слова имени — две буквы', () => {
    expect(accountInitials([p('vk', 'Пётр Иванов')])).toBe('ПИ');
  });
  it('одно слово — одна буква', () => {
    expect(accountInitials([p('telegram', 'anna')])).toBe('A');
  });
  it('без имени — по email', () => {
    expect(accountInitials([p('google', null, 'user@gmail.com')])).toBe('U');
  });
  it('имя в приоритете над email', () => {
    expect(accountInitials([p('google', null, 'a@b.c'), p('vk', 'Мария')])).toBe('М');
  });
});
