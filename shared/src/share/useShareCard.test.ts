// @vitest-environment jsdom
// Тесты логики шита шаринга: успешный шэр шлёт оба события аналитики,
// упавший — помечает ok:false, копирует текст в буфер и показывает его
// пользователю (иначе поделиться нечем).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useShareCard } from './useShareCard';

const shareCanvasImage = vi.hoisted(() => vi.fn());
vi.mock('./shareImage', () => ({ shareCanvasImage }));

const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText },
  configurable: true,
});

function setup(over: Partial<Parameters<typeof useShareCard>[0]> = {}) {
  const track = vi.fn();
  const opts = {
    draw: vi.fn(),
    shareText: 'короткий текст',
    filename: 'card.png',
    eventKind: 'day' as const,
    track,
    ...over,
  };
  const canvasRef = createRef<HTMLCanvasElement>();
  canvasRef.current = document.createElement('canvas');
  const hook = renderHook(() => useShareCard(canvasRef, opts));
  return { hook, track };
}

beforeEach(() => {
  shareCanvasImage.mockReset();
  writeText.mockClear();
});

describe('useShareCard', () => {
  it('успешный шэр шлёт share_card и share_result ok:true', async () => {
    shareCanvasImage.mockResolvedValue('shared');
    const { hook, track } = setup();

    await act(() => hook.result.current.share());

    expect(track).toHaveBeenCalledWith('share_card', { kind: 'day' });
    expect(track).toHaveBeenCalledWith('share_result', {
      kind: 'day',
      ok: true,
    });
    expect(hook.result.current.showText).toBe(false);
  });

  it('упавший шэр: ok:false, текст в буфере и на экране', async () => {
    shareCanvasImage.mockRejectedValue(new Error('share unavailable'));
    const { hook, track } = setup({ fallbackText: 'подробный текст' });

    await act(() => hook.result.current.share());

    expect(track).toHaveBeenCalledWith('share_result', {
      kind: 'day',
      ok: false,
    });
    expect(track).not.toHaveBeenCalledWith('share_card', { kind: 'day' });
    expect(writeText).toHaveBeenCalledWith('подробный текст');
    expect(hook.result.current.showText).toBe(true);
    expect(hook.result.current.copied).toBe(true);
  });

  it('копирование берёт подробный текст, а не короткий', async () => {
    const { hook } = setup({ fallbackText: 'подробный текст' });

    await act(() => hook.result.current.copy());

    expect(writeText).toHaveBeenCalledWith('подробный текст');
    expect(hook.result.current.text).toBe('подробный текст');
  });

  it('без подробного текста копируется короткий', async () => {
    const { hook } = setup();

    await act(() => hook.result.current.copy());

    expect(writeText).toHaveBeenCalledWith('короткий текст');
  });
});
