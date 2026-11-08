// @vitest-environment jsdom
// usePageShowReset (аудит 2026-11, E14): «Назад» со страницы оплаты достаёт
// страницу из bfcache вместе с состоянием React. Сброс — только на
// восстановлении из кэша (`persisted`), обычная загрузка состояние не трогает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { usePageShowReset } from './usePageShowReset';

afterEach(cleanup);

const pageShow = (persisted: boolean) =>
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted }));

describe('usePageShowReset', () => {
  it('страница из bfcache — сброс; обычный pageshow — нет', () => {
    const reset = vi.fn();
    renderHook(() => usePageShowReset(reset));
    pageShow(false);
    expect(reset).not.toHaveBeenCalled();
    pageShow(true);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('зовёт свежий колбэк после перерисовки и снимает слушатель при размонтировании', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ cb }) => usePageShowReset(cb), { initialProps: { cb: first } });
    rerender({ cb: second });
    pageShow(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    unmount();
    pageShow(true);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
