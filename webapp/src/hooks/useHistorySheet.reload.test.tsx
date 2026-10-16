// @vitest-environment jsdom
// Перезагрузка страницы при открытом листе (находка ревью 2026-10). Запись
// истории с `__sheetStack` переживает перезагрузку, а счётчик useId — нет:
// тот же лист после перезагрузки получал тот же id, находил его в стеке записи
// прошлой жизни страницы, и первое «Назад» его не закрывало (воспроизведено в
// Chromium на createBrowserRouter). useId здесь подменён постоянным значением —
// так совпадение id из прошлой жизни воспроизводится детерминированно.
import { it, expect, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useHistorySheet } from './useHistorySheet';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useId: () => '_r_5_',
}));

it('запись прошлой жизни страницы с тем же useId не мешает «Назад» закрыть лист', () => {
  const nav: { go: NavigateFunction | null } = { go: null };
  function NavSpy() {
    const navigate = useNavigate();
    useEffect(() => { nav.go = navigate; });
    return null;
  }
  // Запись, оставленная листом до перезагрузки: тот же useId в стеке.
  const stale = { __sheetId: '_r_5_', __sheetStack: ['_r_5_'] };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/hub', { pathname: '/page', state: stale }]} initialIndex={1}>
      <NavSpy />
      {children}
    </MemoryRouter>
  );
  const onClose = vi.fn();
  renderHook(() => useHistorySheet(onClose), { wrapper });

  act(() => { nav.go!(-1); });

  expect(onClose).toHaveBeenCalledTimes(1);
});
