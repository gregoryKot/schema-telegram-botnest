// @vitest-environment jsdom
// E-1, путь мини-аппа: владелец данных по id площадки, до рендера.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HostId } from '../host';

// getHost() определяет площадку по окружению и перезаписывает подставной хост,
// поэтому подменяем модуль целиком: тут важен только id и user().
let fakeHost: { id: HostId; user: () => { id: string } | null };
vi.mock('../host', () => ({ getHost: () => fakeHost }));

import { DATA_OWNER_KEY } from './dataOwnerGuard';
import {
  HOST_OWNER_KEY,
  ensureHostOwner,
  markHostSessionStarted,
  rememberHostOwner,
} from './hostOwnerGuard';

const jwt = (sub: string) => `h.${btoa(JSON.stringify({ sub }))}.s`;

function useHost(id: HostId, userId: string | null) {
  fakeHost = { id, user: () => (userId ? { id: userId } : null) };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('ensureHostOwner', () => {
  it('другой пользователь площадки → данные стёрты, новый владелец запомнен, тема осталась', () => {
    useHost('telegram', '222');
    localStorage.setItem(HOST_OWNER_KEY, 'telegram:111');
    localStorage.setItem('rating_outbox_v1', '[1]');
    localStorage.setItem('therapist_mode', '1');
    localStorage.setItem('app_theme', 'dark');
    expect(ensureHostOwner()).toBe(true);
    expect(localStorage.getItem('rating_outbox_v1')).toBeNull();
    expect(localStorage.getItem('therapist_mode')).toBeNull();
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem(HOST_OWNER_KEY)).toBe('telegram:222');
  });

  it('тот же пользователь площадки → ничего не трогает', () => {
    useHost('telegram', '111');
    localStorage.setItem(HOST_OWNER_KEY, 'telegram:111');
    localStorage.setItem('rating_outbox_v1', '[1]');
    expect(ensureHostOwner()).toBe(false);
    expect(localStorage.getItem('rating_outbox_v1')).toBe('[1]');
  });

  it('записи нет (первый запуск после деплоя) → не стирает и сам не пишет', () => {
    useHost('telegram', '222');
    localStorage.setItem('rating_outbox_v1', '[1]');
    expect(ensureHostOwner()).toBe(false);
    expect(localStorage.getItem('rating_outbox_v1')).toBe('[1]');
    expect(localStorage.getItem(HOST_OWNER_KEY)).toBeNull();
  });

  it('хост не знает пользователя (веб) → не трогает, запись цела', () => {
    useHost('web', null);
    localStorage.setItem(HOST_OWNER_KEY, 'telegram:111');
    localStorage.setItem('rating_outbox_v1', '[1]');
    expect(ensureHostOwner()).toBe(false);
    expect(localStorage.getItem('rating_outbox_v1')).toBe('[1]');
    expect(localStorage.getItem(HOST_OWNER_KEY)).toBe('telegram:111');
  });

  it('тот же id на другой площадке — другой владелец (префикс площадки)', () => {
    useHost('max', '111');
    localStorage.setItem(HOST_OWNER_KEY, 'telegram:111');
    localStorage.setItem('rating_outbox_v1', '[1]');
    expect(ensureHostOwner()).toBe(true);
    expect(localStorage.getItem('rating_outbox_v1')).toBeNull();
  });
});

describe('markHostSessionStarted', () => {
  it('записывает владельца площадки уже ПОСЛЕ сверки по токену (её clear его не смывает)', () => {
    useHost('telegram', '222');
    localStorage.setItem(DATA_OWNER_KEY, '111');
    localStorage.setItem('rating_outbox_v1', '[1]');
    markHostSessionStarted(jwt('222'));
    expect(localStorage.getItem('rating_outbox_v1')).toBeNull();
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('222');
    expect(localStorage.getItem(HOST_OWNER_KEY)).toBe('telegram:222');
  });

  it('привязанное устройство (sub ≠ id площадки) не стирается при повторном входе', () => {
    useHost('telegram', '555');
    // device-link: данные принадлежат аккаунту 999, площадка — 555.
    markHostSessionStarted(jwt('999'));
    localStorage.setItem('rating_outbox_v1', '[1]');
    expect(ensureHostOwner()).toBe(false);
    markHostSessionStarted(jwt('999'));
    expect(localStorage.getItem('rating_outbox_v1')).toBe('[1]');
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('999');
  });
});

describe('rememberHostOwner', () => {
  it('без user() ничего не пишет', () => {
    useHost('web', null);
    rememberHostOwner();
    expect(localStorage.getItem(HOST_OWNER_KEY)).toBeNull();
  });
});
