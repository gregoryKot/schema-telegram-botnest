// @vitest-environment jsdom
// Шаринг карточки стрика с экрана празднования: отмена системной шторки —
// не сбой (ни ok:false, ни текста в буфере), настоящий сбой — текст в буфер.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MouseEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { useCelebration } from './useCelebration';

const shareCanvasImage = vi.hoisted(() => vi.fn());
vi.mock('../share/shareImage', () => ({ shareCanvasImage }));
vi.mock('../share/cards/streakCard', () => ({
  drawStreakCard: vi.fn(),
  MILESTONES: [3, 7],
}));
vi.mock('./useConfetti', () => ({ useConfetti: () => ({ current: null }) }));

const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText },
  configurable: true,
});

const click = { stopPropagation: vi.fn() } as unknown as MouseEvent;

function setup() {
  const track = vi.fn();
  const hook = renderHook(() =>
    useCelebration(7, vi.fn(), 'https://t.me/bot', track),
  );
  return { hook, track };
}

beforeEach(() => {
  shareCanvasImage.mockReset();
  writeText.mockClear();
});

describe('useCelebration share', () => {
  it('отмена шторки (AbortError) — без ok:false и без копирования', async () => {
    shareCanvasImage.mockRejectedValue(
      new DOMException('Share canceled', 'AbortError'),
    );
    const { hook, track } = setup();

    await act(() => hook.result.current.share(click));

    expect(track).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(hook.result.current.copied).toBe(false);
  });

  it('шэр недоступен — ok:false и текст в буфере', async () => {
    shareCanvasImage.mockRejectedValue(new Error('share unavailable'));
    const { hook, track } = setup();

    await act(() => hook.result.current.share(click));

    expect(track).toHaveBeenCalledWith('share_result', {
      kind: 'streak',
      ok: false,
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(hook.result.current.copied).toBe(true);
  });

  it('isMilestone — по общему списку вех карточки', () => {
    expect(setup().hook.result.current.isMilestone).toBe(true);
  });
});
