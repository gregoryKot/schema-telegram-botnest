// @vitest-environment jsdom
// useSessionExpired — регресс-тест на инцидент 2026-07-29: 401 в середине
// сессии не показывался, приложение молча переставало сохранять (правило №4
// CLAUDE.md, «провал не выглядит как успех»). Проверяем, что событие
// SESSION_EXPIRED_EVENT реально долетает до состояния хука.
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSessionExpired } from './useSessionExpired';
import { SESSION_EXPIRED_EVENT } from '../session';

describe('useSessionExpired', () => {
  it('изначально false — сессия не считается истёкшей до события', () => {
    const { result } = renderHook(() => useSessionExpired());
    expect(result.current).toBe(false);
  });

  it('после SESSION_EXPIRED_EVENT становится true (регресс 2026-07-29)', () => {
    const { result } = renderHook(() => useSessionExpired());
    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });
    expect(result.current).toBe(true);
  });

  it('отписывается при размонтировании — событие после unmount не падает', () => {
    const { unmount } = renderHook(() => useSessionExpired());
    unmount();
    expect(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }).not.toThrow();
  });
});
