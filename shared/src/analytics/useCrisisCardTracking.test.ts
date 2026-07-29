// @vitest-environment jsdom
// Прямой тест хука (правило №8): показ трекается один раз на маунт/смену
// surface, обработчик клика трекает нажатие — независимо от компонента,
// который его использует (CrisisCard.tsx).
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrisisCardTracking } from './useCrisisCardTracking';

describe('useCrisisCardTracking', () => {
  it('surface задан: маунт трекает crisis_card_shown с {surface}', () => {
    const track = vi.fn();
    renderHook(() => useCrisisCardTracking('note', track));
    expect(track).toHaveBeenCalledWith('crisis_card_shown', {
      surface: 'note',
    });
  });

  it('surface отсутствует: маунт ничего не трекает', () => {
    const track = vi.fn();
    renderHook(() => useCrisisCardTracking(undefined, track));
    expect(track).not.toHaveBeenCalled();
  });

  it('возвращённый обработчик трекает crisis_hotline_tapped с тем же surface', () => {
    const track = vi.fn();
    const { result } = renderHook(() => useCrisisCardTracking('letter', track));
    track.mockClear();
    result.current();
    expect(track).toHaveBeenCalledWith('crisis_hotline_tapped', {
      surface: 'letter',
    });
  });

  it('обработчик без surface — no-op', () => {
    const track = vi.fn();
    const { result } = renderHook(() =>
      useCrisisCardTracking(undefined, track),
    );
    result.current();
    expect(track).not.toHaveBeenCalled();
  });

  it('смена surface между рендерами трекает повторный показ с новым surface', () => {
    const track = vi.fn();
    const { rerender } = renderHook(
      ({ surface }: { surface: string | undefined }) =>
        useCrisisCardTracking(surface, track),
      { initialProps: { surface: 'note' } },
    );
    track.mockClear();
    rerender({ surface: 'letter' });
    expect(track).toHaveBeenCalledWith('crisis_card_shown', {
      surface: 'letter',
    });
  });
});
