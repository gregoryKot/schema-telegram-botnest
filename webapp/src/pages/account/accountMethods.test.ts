import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { accountInitials, canUnlink, countMethods, LOGIN_PROVIDERS, OAUTH_METHODS, unlinkBlockedWhy } from './accountMethods';
import type { AccountProvider } from './ProviderRows';

const p = (provider: AccountProvider['provider'], displayName: string | null = null, email: string | null = null): AccountProvider => ({ provider, displayName, email });

describe('countMethods', () => {
  it('чистый аккаунт — 0 из 2 (MAX, Telegram и Google без привязки не считаются)', () => {
    expect(countMethods([])).toEqual({ linked: 0, total: 2 });
  });
  it('считает привязанные; почта — не способ входа', () => {
    expect(countMethods([p('vk'), p('email')])).toEqual({ linked: 1, total: 2 });
    expect(countMethods([p('vk'), p('yandex'), p('email')])).toEqual({ linked: 2, total: 2 });
    expect(countMethods([p('email')])).toEqual({ linked: 0, total: 2 });
  });
  it('Яндекс — своя строка: привязан — в счёт, не привязан — в знаменателе', () => {
    expect(OAUTH_METHODS).toEqual(['vk', 'yandex']);
    expect(countMethods([p('yandex')])).toEqual({ linked: 1, total: 2 });
  });
  it('аккаунт только с Telegram — 1 из 3: VK ID и Яндекс ID ещё впереди', () => {
    expect(countMethods([p('telegram')])).toEqual({ linked: 1, total: 3 });
  });
  it('привязанные MAX и прежний Google добавляют по строке', () => {
    expect(countMethods([p('vk'), p('max')])).toEqual({ linked: 2, total: 3 });
    expect(countMethods([p('google')])).toEqual({ linked: 1, total: 3 });
    expect(countMethods([p('google'), p('max')])).toEqual({ linked: 2, total: 4 });
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
// Правило то же, что на сервере (src/auth/unlink-provider.ts): после отвязки
// остаётся вход — VK ID, Яндекс ID, Telegram, MAX или номер из Telegram.
const WEB = '1000000000000007';
const TG = '777';

describe('canUnlink', () => {
  it('VK + почта: VK — нельзя, почту — можно', () => {
    expect(canUnlink([p('vk'), p('email')], 'vk', WEB)).toBe(false);
    expect(canUnlink([p('vk'), p('email')], 'email', WEB)).toBe(true);
  });
  it('почта и Google входом не считаются', () => {
    expect(canUnlink([p('google'), p('email')], 'google', WEB)).toBe(false);
    expect(canUnlink([p('google'), p('email')], 'email', WEB)).toBe(false);
    expect(canUnlink([p('email'), p('email')], 'email', WEB)).toBe(false);
  });
  it('Telegram и MAX — вход: почту рядом с ними отвязать можно', () => {
    expect(canUnlink([p('telegram'), p('email')], 'email', WEB)).toBe(true);
    expect(canUnlink([p('max'), p('email')], 'email', WEB)).toBe(true);
    expect(canUnlink([p('telegram'), p('email')], 'telegram', WEB)).toBe(false);
  });
  it('номер из Telegram входит через бота: отвязать можно всё', () => {
    expect(canUnlink([p('email')], 'email', TG)).toBe(true);
    expect(canUnlink([p('telegram')], 'telegram', TG)).toBe(true);
  });
  it('номер ещё не пришёл (null) — правило веб-аккаунта, без поблажки', () => {
    expect(canUnlink([p('email')], 'email', null)).toBe(false);
  });
});

describe('unlinkBlockedWhy', () => {
  it('можно отвязать — причины нет', () => {
    expect(unlinkBlockedWhy([p('vk'), p('yandex')], 'vk', WEB)).toBeNull();
  });
  it('называет, что привязать: второй сервис или любой из двух', () => {
    expect(unlinkBlockedWhy([p('vk')], 'vk', WEB)).toBe('Другого входа в аккаунт нет — отвязать можно, когда привязан Яндекс ID');
    expect(unlinkBlockedWhy([p('yandex')], 'yandex', WEB)).toMatch(/когда привязан VK ID$/);
    expect(unlinkBlockedWhy([p('email')], 'email', WEB)).toMatch(/когда привязан VK ID или Яндекс ID$/);
  });
});

// Сверка с бэкендом (правило №4): чем входят, знают два места — «Отвязать» на
// «Аккаунте» и сервер (src/auth/unlink-provider.ts); сайт бэкендовый модуль не
// импортирует. Разойдутся — кнопка снова поведёт к отказу или спрячет отвязку,
// которую сервер пропустил бы. Граница номеров из Telegram сверена отдельно:
// src/auth/user-id-range.parity.spec.ts.
describe('LOGIN_PROVIDERS — сверка с src/auth/unlink-provider.ts', () => {
  it('сайт и сервер считают входом одни и те же способы', () => {
    const src = readFileSync(resolve(__dirname, '../../../../src/auth/unlink-provider.ts'), 'utf8');
    const m = src.match(/LOGIN_PROVIDERS: readonly string\[\] = \[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const server = [...m![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
    expect([...LOGIN_PROVIDERS].sort()).toEqual(server.sort());
    expect(server).not.toContain('email');
  });
});
