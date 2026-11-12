import { describe, it, expect } from 'vitest';
import { accountInitials, canUnlink, countMethods } from './accountMethods';
import type { AccountProvider } from './ProviderRows';

const p = (provider: AccountProvider['provider'], displayName: string | null = null, email: string | null = null): AccountProvider => ({ provider, displayName, email });

describe('countMethods', () => {
  it('чистый аккаунт — 0 из 3 (MAX и Google без привязки не считаются)', () => {
    expect(countMethods([])).toEqual({ linked: 0, total: 3 });
  });
  it('считает привязанные', () => {
    expect(countMethods([p('vk'), p('email')])).toEqual({ linked: 2, total: 3 });
  });
  it('привязанные MAX и прежний Google добавляют по строке', () => {
    expect(countMethods([p('vk'), p('max')])).toEqual({ linked: 2, total: 4 });
    expect(countMethods([p('google')])).toEqual({ linked: 1, total: 4 });
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

// QA 2026-11, М2: «Отвязать» у единственного способа входа была активна.
describe('canUnlink', () => {
  it('единственный способ — нельзя; есть второй — можно', () => {
    expect(canUnlink([p('google')], 'google')).toBe(false);
    expect(canUnlink([p('google'), p('email')], 'google')).toBe(true);
  });
  it('две строки одного провайдера — всё равно единственный способ (как на сервере)', () => {
    expect(canUnlink([p('email'), p('email')], 'email')).toBe(false);
  });
});
