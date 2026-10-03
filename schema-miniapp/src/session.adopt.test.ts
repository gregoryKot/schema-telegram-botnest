// @vitest-environment jsdom
// Аудит 2026-10, E1: смена аккаунта БЕЗ выхода (device-link, вход поверх
// живого) оставляла в localStorage клинический контент прежнего пользователя.
// Проверяем оба входа токена в сессию: adoptSession и обычный перевыпуск.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adoptSession, clearSession, renewSession } from './session';
import { DATA_OWNER_KEY } from '../../shared/src/auth/dataOwnerGuard';

const jwt = (sub: string) =>
  `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;

beforeEach(() => {
  clearSession();
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = vi.fn();
});

describe('adoptSession', () => {
  it('стирает локальные данные прежнего аккаунта, тему и баннер кук оставляет', () => {
    localStorage.setItem('safe_place', JSON.stringify({ text: 'текст А' }));
    localStorage.setItem('diary_draft_x', 'черновик А');
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('cookie_consent', 'accepted');

    adoptSession(jwt('77'), 900);

    expect(localStorage.getItem('safe_place')).toBeNull();
    expect(localStorage.getItem('diary_draft_x')).toBeNull();
    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem('cookie_consent')).toBe('accepted');
    // и новый владелец запомнен — следующая смена будет распознана
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('77');
    expect(localStorage.getItem('auth_seen')).toBe('1');
  });
});

describe('смена владельца при обычном перевыпуске сессии', () => {
  it('токен другого пользователя стирает данные прежнего', async () => {
    localStorage.setItem(DATA_OWNER_KEY, '42');
    localStorage.setItem('letters_to_self', '[{"text":"А"}]');
    (window as unknown as { Telegram?: unknown }).Telegram = {
      WebApp: { initData: 'query_id=A&hash=b' },
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: vi
        .fn()
        .mockResolvedValue({ accessToken: jwt('77'), expiresIn: 900 }),
    });

    await renewSession();

    expect(localStorage.getItem('letters_to_self')).toBeNull();
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('77');
  });
});
