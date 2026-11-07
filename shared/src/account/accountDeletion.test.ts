// @vitest-environment jsdom
// QA 2026-11, К2/З2: после удаления аккаунта экран входа говорил «Вход
// устарел — данные на месте», а в браузере оставались настройки и контакт
// терапевта удалённого человека.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACCOUNT_DELETED_TEXT,
  clearAccountDeletedMark,
  deleteAccountCopy,
  isAccountJustDeleted,
  wipeAfterAccountDeletion,
} from './accountDeletion';
import { hasAuthSeen, markAuthSeen } from '../auth/authSeen';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('wipeAfterAccountDeletion', () => {
  it('стирает личное и отметку «уже входил», оставляет тему и согласие на cookie', () => {
    markAuthSeen();
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('cookie_consent', 'accepted');
    sessionStorage.setItem('auth_return_to', '/account');
    wipeAfterAccountDeletion();
    expect(hasAuthSeen()).toBe(false);
    expect(localStorage.getItem('therapy_contact_url')).toBeNull();
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem('cookie_consent')).toBe('accepted');
    expect(sessionStorage.getItem('auth_return_to')).toBeNull();
  });

  it('удаление → экран входа знает, что аккаунт удалён; после показа — уже нет', () => {
    expect(isAccountJustDeleted()).toBe(false);
    wipeAfterAccountDeletion();
    expect(isAccountJustDeleted()).toBe(true);
    clearAccountDeletedMark();
    expect(isAccountJustDeleted()).toBe(false);
  });
});

describe('deleteAccountCopy — текст говорит правду (З2)', () => {
  it('удаляется аккаунт целиком: способы входа и связь с терапевтом тоже', () => {
    const c = deleteAccountCopy(ty);
    expect(c.row).toBe('Удалить аккаунт');
    expect(c.body).toMatch(/аккаунт целиком/);
    expect(c.body).toMatch(/способы входа/);
    expect(c.body).toMatch(/связь с терапевтом/);
    expect(ACCOUNT_DELETED_TEXT).toMatch(/^Аккаунт удалён/);
  });

  it('ошибка — в обеих формах обращения', () => {
    expect(deleteAccountCopy(ty).failed).toMatch(/попробуй ещё раз/);
    expect(deleteAccountCopy(vy).failed).toMatch(/попробуйте ещё раз/);
  });
});
