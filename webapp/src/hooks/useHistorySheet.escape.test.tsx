// @vitest-environment jsdom
// Гонка «Escape + goBack из ответа сохранения»: Escape ставит тот же гард, что goBack,
// иначе второй шаг назад уводил со страницы (закрывал весь лист настроек).
import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, type Location } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useHistorySheet } from './useHistorySheet';

describe('useHistorySheet — Escape и goBack в одном такте', () => {
  it('goBack сразу после Escape — no-op: страница под листом остаётся', () => {
    const seen: { loc: Location | null } = { loc: null };
    function Spy() {
      const l = useLocation();
      useEffect(() => { seen.loc = l; });
      return null;
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/hub', '/page']} initialIndex={1}>
        <Spy />
        {children}
      </MemoryRouter>
    );
    const onClose = vi.fn();
    const { result } = renderHook(() => useHistorySheet(onClose), { wrapper });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      result.current(); // ответ сохранения пришёл до перехода
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(seen.loc!.pathname).toBe('/page');
  });
});
