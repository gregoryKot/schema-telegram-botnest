// @vitest-environment jsdom
// Тест общей логики автосохранения интро-карточек (ModeIntroSheet/SchemaIntroSheet,
// вынесено правилом №11 CLAUDE.md — было продублировано между режимами и схемами).
// Правило CLAUDE.md о read-after-write: набор данных пишется в localStorage
// синхронно на каждый set() и ещё раз при handleSave — здесь проверяется не
// только «вызвался saveNote», но и что промежуточное состояние действительно
// читаемо (localStorage) до того, как долетит debounce/сеть.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIntroSheetData } from './useIntroSheetData';

interface Data {
  q1: string;
  q2: string;
}

const emptyData: Data = { q1: '', q2: '' };

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

// Промежуток между set() и debounced saveNote — тесты на автосейв включают
// фейковые таймеры сами, чтобы не ждать 1500/1800ms реальными часами.
// waitFor из testing-library полагается на реальный setInterval, поэтому
// с загрузкой (loadExisting) фейковые таймеры не совмещаем.
async function flushLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useIntroSheetData — загрузка', () => {
  it('loadExisting вернул заметку — данные подставляются из неё', async () => {
    const loadExisting = vi.fn().mockResolvedValue({ q1: 'из бэка', q2: '' });
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k1',
        emptyData,
        loadExisting,
        saveNote,
      }),
    );

    await flushLoad();
    expect(result.current.data.q1).toBe('из бэка');
  });

  it('loadExisting вернул null — фолбэк на localStorage, если там что-то есть', async () => {
    localStorage.setItem('k2', JSON.stringify({ q1: 'из хранилища', q2: '' }));
    const loadExisting = vi.fn().mockResolvedValue(null);
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k2',
        emptyData,
        loadExisting,
        saveNote,
      }),
    );

    await flushLoad();
    expect(result.current.data.q1).toBe('из хранилища');
  });

  it('loadExisting упал (реджект) — тоже фолбэк на localStorage', async () => {
    localStorage.setItem(
      'k3',
      JSON.stringify({ q1: 'выжило после ошибки', q2: '' }),
    );
    const loadExisting = vi.fn().mockRejectedValue(new Error('network'));
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k3',
        emptyData,
        loadExisting,
        saveNote,
      }),
    );

    await flushLoad();
    expect(result.current.data.q1).toBe('выжило после ошибки');
  });

  it('loadExisting вернул null, localStorage пуст — остаётся emptyData', async () => {
    const loadExisting = vi.fn().mockResolvedValue(null);
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k4',
        emptyData,
        loadExisting,
        saveNote,
      }),
    );

    await flushLoad();
    expect(loadExisting).toHaveBeenCalled();
    expect(result.current.data).toEqual(emptyData);
    expect(result.current.hasAny).toBe(false);
  });
});

describe('useIntroSheetData — set() и автосохранение', () => {
  it('set() пишет в localStorage синхронно и планирует автосейв через 1500ms', async () => {
    const loadExisting = vi.fn().mockResolvedValue(null);
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k5',
        emptyData,
        loadExisting,
        saveNote,
      }),
    );
    await flushLoad();
    vi.useFakeTimers();

    act(() => {
      result.current.set('q1', 'ответ');
    });

    // read-after-write: сразу после set() читаемо из localStorage, ещё до debounce.
    expect(JSON.parse(localStorage.getItem('k5')!).q1).toBe('ответ');
    expect(saveNote).not.toHaveBeenCalled();
    expect(result.current.hasAny).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(saveNote).toHaveBeenCalledWith(
      expect.objectContaining({ q1: 'ответ' }),
    );
  });

  it('повторный set() до истечения debounce перезапускает таймер (saveNote вызывается один раз)', async () => {
    const loadExisting = vi.fn().mockResolvedValue(null);
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k6',
        emptyData,
        loadExisting,
        saveNote,
      }),
    );
    await flushLoad();
    vi.useFakeTimers();

    act(() => {
      result.current.set('q1', 'первый');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      result.current.set('q1', 'второй');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveNote).not.toHaveBeenCalled(); // 1000+1000 > 1500, но таймер сбрасывался

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(saveNote).toHaveBeenCalledWith(
      expect.objectContaining({ q1: 'второй' }),
    );
  });
});

describe('useIntroSheetData — handleSave()', () => {
  it('сохраняет немедленно, зовёт onComplete, выставляет saved на 1800ms и очищает флаг', async () => {
    const loadExisting = vi.fn().mockResolvedValue(null);
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k7',
        emptyData,
        loadExisting,
        saveNote,
        onComplete,
      }),
    );
    await flushLoad();
    vi.useFakeTimers();

    act(() => {
      result.current.set('q1', 'финальный ответ');
    });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(saveNote).toHaveBeenCalledWith(
      expect.objectContaining({ q1: 'финальный ответ' }),
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
    expect(result.current.saved).toBe(true);
    // read-after-write: сохранённое видно в localStorage сразу после handleSave.
    expect(JSON.parse(localStorage.getItem('k7')!).q1).toBe('финальный ответ');

    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(result.current.saved).toBe(false);
  });

  it('handleSave() отменяет незавершённый debounce-автосейв (saveNote вызывается один раз)', async () => {
    const loadExisting = vi.fn().mockResolvedValue(null);
    const saveNote = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k8',
        emptyData,
        loadExisting,
        saveNote,
      }),
    );
    await flushLoad();
    vi.useFakeTimers();

    act(() => {
      result.current.set('q1', 'ответ');
    });
    await act(async () => {
      await result.current.handleSave();
    });
    // Если бы отложенный автосейв не отменился, он бы сработал здесь и дал вызов #2.
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(saveNote).toHaveBeenCalledTimes(1);
  });

  it('saveNote упал — handleSave не бросает, saved всё равно true', async () => {
    const loadExisting = vi.fn().mockResolvedValue(null);
    const saveNote = vi.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      useIntroSheetData({
        storageKey: 'k9',
        emptyData,
        loadExisting,
        saveNote,
      }),
    );
    await flushLoad();

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.saving).toBe(false);
    expect(result.current.saved).toBe(true);
  });
});
