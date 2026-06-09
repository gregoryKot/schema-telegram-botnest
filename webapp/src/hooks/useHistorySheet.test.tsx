import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useHistorySheet } from './useHistorySheet';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/today']}>{children}</MemoryRouter>;
}

describe('useHistorySheet', () => {
  it('возвращает функцию goBack', () => {
    const { result } = renderHook(() => useHistorySheet(vi.fn()), { wrapper });
    expect(typeof result.current).toBe('function');
  });

  it('не вызывает onClose при монтировании (лист только открылся)', () => {
    const onClose = vi.fn();
    renderHook(() => useHistorySheet(onClose), { wrapper });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('вызывает onClose, когда пользователь жмёт «назад» (goBack)', async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useHistorySheet(onClose), { wrapper });

    // Лист запушил свою запись в историю; имитируем нажатие «назад».
    act(() => {
      result.current();
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
