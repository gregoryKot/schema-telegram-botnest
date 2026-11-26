// @vitest-environment jsdom
// Регрессия прода 2026-08-31: «Тяжело прямо сейчас →» закрывала поток
// (onHardNow=close/exitFlow) — кризисный путь (правило №7) выбрасывал из
// разбора. Хук держит открытие/закрытие карточки поддержки на месте; связка
// с потоком — useCaseFlowState.test.ts, разметка — тесты площадок.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHardNowSupport, useSupportCardReveal } from './useCaseSupport';

describe('useHardNowSupport', () => {
  it('handleHardNow открывает, closeSupport закрывает', () => {
    const { result } = renderHook(() => useHardNowSupport());
    expect(result.current.hardNow).toBe(false);

    act(() => result.current.handleHardNow());
    expect(result.current.hardNow).toBe(true);

    act(() => result.current.closeSupport());
    expect(result.current.hardNow).toBe(false);
  });
});

describe('useSupportCardReveal', () => {
  it('прокручивает к карточке при открытии, а не на каждом рендере', () => {
    const el = document.createElement('div');
    const scrollIntoView = vi.fn();
    (el as unknown as { scrollIntoView: () => void }).scrollIntoView =
      scrollIntoView;

    const { result, rerender } = renderHook(
      ({ open }) => useSupportCardReveal(open),
      { initialProps: { open: false } },
    );
    result.current.current = el;
    expect(scrollIntoView).not.toHaveBeenCalled();

    rerender({ open: true });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender({ open: true });
    expect(scrollIntoView).toHaveBeenCalledTimes(1); // только на открытие
  });

  it('не падает, когда scrollIntoView недоступен (jsdom)', () => {
    const { result, rerender } = renderHook(
      ({ open }) => useSupportCardReveal(open),
      { initialProps: { open: false } },
    );
    result.current.current = document.createElement('div');
    expect(() => rerender({ open: true })).not.toThrow();
  });
});
