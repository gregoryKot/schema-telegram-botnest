// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from './useCopyToClipboard';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

describe('useCopyToClipboard — успех', () => {
  it('copy() пишет в буфер, выставляет copied=true, возвращает true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    const { result } = renderHook(() => useCopyToClipboard());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy('текст');
    });

    expect(writeText).toHaveBeenCalledWith('текст');
    expect(ok).toBe(true);
    expect(result.current.copied).toBe(true);
    expect(result.current.failed).toBe(false);
  });

  it('copied сбрасывается через resetMs (по умолчанию 2000)', async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('текст');
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(false);
  });

  it('повторный вызов сбрасывает предыдущий таймер — второй клик не гасит состояние раньше времени', async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('первый');
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Второй copy() до истечения первого таймера — не должен погаснуть раньше нового срока
    await act(async () => {
      await result.current.copy('второй');
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copied).toBe(true); // прошло 1500мс с ВТОРОГО вызова, не 3000мс с первого

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });
});

describe('useCopyToClipboard — сбой', () => {
  it('writeText отклоняется — failed=true, copied=false, возвращает false, onError вызван', async () => {
    const err = new Error('denied');
    mockClipboard(vi.fn().mockRejectedValue(err));
    const onError = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard({ onError }));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy('текст');
    });

    expect(ok).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(result.current.copied).toBe(false);
    expect(onError).toHaveBeenCalledWith(err);
  });

  it('не пробрасывает ошибку наружу', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const { result } = renderHook(() => useCopyToClipboard());

    await expect(
      act(async () => {
        await result.current.copy('текст');
      }),
    ).resolves.not.toThrow();
  });

  it('navigator.clipboard отсутствует целиком (старый WebView) — тоже путь сбоя', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const onError = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard({ onError }));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.copy('текст');
    });

    expect(ok).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(onError).toHaveBeenCalled();
  });

  it('failed сбрасывается через resetMs', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const { result } = renderHook(() => useCopyToClipboard({ resetMs: 1000 }));

    await act(async () => {
      await result.current.copy('текст');
    });
    expect(result.current.failed).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.failed).toBe(false);
  });
});

describe('useCopyToClipboard — размонтирование', () => {
  it('размонтирование до срабатывания таймера не роняет тест и не трогает состояние', async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('текст');
    });
    expect(result.current.copied).toBe(true);

    unmount();
    // Таймер обязан быть очищен при размонтировании — advance не должен
    // приводить к ошибке «setState после unmount» или зависшему таймеру.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    }).not.toThrow();
  });
});
