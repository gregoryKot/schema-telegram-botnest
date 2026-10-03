// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DATA_OWNER_KEY,
  ensureDataOwner,
  ensureDataOwnerForToken,
  markSessionStarted,
  tokenSubject,
} from './dataOwnerGuard';

const jwt = (payload: object) =>
  `h.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('ensureDataOwner', () => {
  it('тот же владелец → ничего не стирается', () => {
    localStorage.setItem(DATA_OWNER_KEY, '42');
    localStorage.setItem('safe_place', 'текст А');
    expect(ensureDataOwner('42')).toBe(false);
    expect(localStorage.getItem('safe_place')).toBe('текст А');
  });

  it('другой владелец → клинические данные стёрты, новый id запомнен, тема осталась', () => {
    localStorage.setItem(DATA_OWNER_KEY, '42');
    localStorage.setItem('safe_place', 'текст А');
    localStorage.setItem('letters_to_self', '[1]');
    localStorage.setItem('rating_outbox_v1', '[1]');
    localStorage.setItem('app_theme', 'dark');
    expect(ensureDataOwner('77')).toBe(true);
    expect(localStorage.getItem('safe_place')).toBeNull();
    expect(localStorage.getItem('letters_to_self')).toBeNull();
    expect(localStorage.getItem('rating_outbox_v1')).toBeNull();
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('77');
  });

  it('владельца не было → только запоминаем, имеющееся не трогаем', () => {
    localStorage.setItem('safe_place', 'текст до внедрения защиты');
    expect(ensureDataOwner('42')).toBe(false);
    expect(localStorage.getItem('safe_place')).toBe(
      'текст до внедрения защиты',
    );
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('42');
  });

  it('пустой id → ничего не делает', () => {
    localStorage.setItem(DATA_OWNER_KEY, '42');
    localStorage.setItem('safe_place', 'x');
    expect(ensureDataOwner('')).toBe(false);
    expect(localStorage.getItem('safe_place')).toBe('x');
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('42');
  });

  it('хранилище недоступно → не бросает', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => ensureDataOwner('42')).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('tokenSubject / ensureDataOwnerForToken', () => {
  it('читает sub из base64url-полезной нагрузки', () => {
    expect(tokenSubject(jwt({ sub: '123456789', type: 'access' }))).toBe(
      '123456789',
    );
    expect(tokenSubject(jwt({ sub: 'u??>>~~' }))).toBe('u??>>~~'); // символы, дающие + и / в base64
  });

  it('мусор и токен без sub → null', () => {
    expect(tokenSubject('не-токен')).toBeNull();
    expect(tokenSubject('a.%%%.c')).toBeNull();
    expect(tokenSubject(jwt({ type: 'access' }))).toBeNull();
  });

  it('смена sub в токене чистит данные; токен без sub не чистит', () => {
    ensureDataOwnerForToken(jwt({ sub: '1' }));
    localStorage.setItem('safe_place', 'текст А');
    expect(ensureDataOwnerForToken(jwt({ type: 'access' }))).toBe(false);
    expect(localStorage.getItem('safe_place')).toBe('текст А');
    expect(ensureDataOwnerForToken(jwt({ sub: '2' }))).toBe(true);
    expect(localStorage.getItem('safe_place')).toBeNull();
  });
});

describe('markSessionStarted', () => {
  it('при смене владельца стирает данные, но отметка входа остаётся (порядок)', () => {
    markSessionStarted(jwt({ sub: '1' }));
    localStorage.setItem('safe_place', 'текст А');
    markSessionStarted(jwt({ sub: '2' }));
    expect(localStorage.getItem('safe_place')).toBeNull();
    expect(localStorage.getItem('auth_seen')).toBe('1');
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('2');
  });
});
