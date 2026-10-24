// @vitest-environment jsdom
// Состояние листа «Запланировать практику» (webapp ↔ miniapp, правило №3).
// Продублировано 1-в-1 при добавлении .ics — вёрстка каждого фронта своя,
// здесь только загрузка/выбор/сохранение/генерация .ics.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  usePlanSheetState,
  defaultReminderIdx,
  REMINDER_OPTIONS,
} from './usePlanSheetState';
import type { PlanSheetApi } from './usePlanSheetState';

const saveFile = vi.fn();
vi.mock('../host', () => ({ getHost: () => ({ saveFile }) }));

function makeApi(overrides: Partial<PlanSheetApi> = {}): PlanSheetApi {
  return {
    getPractices: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({ notifyTimezone: 'Europe/Moscow' }),
    addPractice: vi.fn().mockResolvedValue(undefined),
    deletePractice: vi.fn().mockResolvedValue(undefined),
    createPlan: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  saveFile.mockClear();
});

describe('defaultReminderIdx', () => {
  afterEach(() => vi.useRealTimers());

  it('утро (до 12) — индекс 0', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 9));
    expect(defaultReminderIdx()).toBe(0);
  });

  it('день (12–17) — индекс 1', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 14));
    expect(defaultReminderIdx()).toBe(1);
  });

  it('вечер (после 17) — индекс 2', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 20));
    expect(defaultReminderIdx()).toBe(2);
  });
});

describe('usePlanSheetState — загрузка', () => {
  afterEach(() => vi.useRealTimers());

  it('успешно грузит практики и таймзону, allOptions мержит свои+готовые', async () => {
    const api = makeApi({
      getPractices: vi
        .fn()
        .mockResolvedValue([{ id: 1, text: 'Своя практика' }]),
    });
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    await waitFor(() => expect(result.current.userPractices.length).toBe(1));
    expect(result.current.practicesFailed).toBe(false);
    expect(result.current.allOptions[0]).toEqual({
      text: 'Своя практика',
      isUser: true,
      id: 1,
    });
    // готовые (curated) не повторяют уже добавленную свою практику
    expect(
      result.current.allOptions.filter((o) => o.text === 'Своя практика')
        .length,
    ).toBe(1);
  });

  it('сбой getPractices — practicesFailed=true (сбой ≠ пусто)', async () => {
    const api = makeApi({
      getPractices: vi.fn().mockRejectedValue(new Error('x')),
    });
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    await waitFor(() => expect(result.current.practicesFailed).toBe(true));
  });

  it('сбой getSettings — деградирует молча (лог, tzOffset остаётся дефолтным)', async () => {
    const api = makeApi({
      getSettings: vi.fn().mockRejectedValue(new Error('offline')),
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    await waitFor(() =>
      expect(errSpy).toHaveBeenCalledWith(
        'getSettings failed',
        expect.any(Error),
      ),
    );
    errSpy.mockRestore();
  });

  it('невалидный часовой пояс — ianaToUtcOffset деградирует до 3, а не падает', async () => {
    // Час напоминания по умолчанию зависит от времени суток
    // (defaultReminderIdx: до 12 — «Утром» 9, после — «Днём» 13). Без
    // закреплённых часов тест зелёный только до полудня по часам машины —
    // так он и жил до 2026-08-23, когда впервые прогнался после обеда.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 0, 1, 9));
    const api = makeApi({
      getSettings: vi.fn().mockResolvedValue({ notifyTimezone: 'Not/AZone' }),
    });
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    // Дождаться, пока getSettings().then(setTzOffset(...)) реально применится
    // (setTzOffset триггерит ререндер — result.current обновится следующим тиком).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => result.current.selectText('Практика'));
    await act(async () => {
      await result.current.handleSave();
    });
    // tzOffset=3 (деградация) + localHour=9 (первый вариант) → UTC 6
    expect(api.createPlan).toHaveBeenCalledWith('attachment', 'Практика', 6);
  });

  it('needId без готовых практик (нет в CURATED) — allOptions не падает, просто пусто', () => {
    const { result } = renderHook(() =>
      usePlanSheetState(
        'несуществующая-потребность',
        'Тест',
        makeApi(),
        vi.fn(),
      ),
    );
    expect(result.current.allOptions).toEqual([]);
  });
});

describe('usePlanSheetState — выбор и правка', () => {
  it('selectText — выставляет selectedText, чистит customText, переходит в confirm', () => {
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', makeApi(), vi.fn()),
    );
    act(() => result.current.setCustomText('черновик'));
    act(() => result.current.selectText('Готовая практика'));
    expect(result.current.selectedText).toBe('Готовая практика');
    expect(result.current.customText).toBe('');
    expect(result.current.phase).toBe('confirm');
  });

  it('handleCustomSubmit — пустой текст не переключает фазу', () => {
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', makeApi(), vi.fn()),
    );
    act(() => result.current.setCustomText('   '));
    act(() => result.current.handleCustomSubmit());
    expect(result.current.phase).toBe('pick');
  });

  it('handleCustomSubmit — обрезает текст и переходит в confirm', () => {
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', makeApi(), vi.fn()),
    );
    act(() => result.current.setCustomText('  своя практика  '));
    act(() => result.current.handleCustomSubmit());
    expect(result.current.selectedText).toBe('своя практика');
    expect(result.current.phase).toBe('confirm');
  });
});

describe('usePlanSheetState — handleDeletePractice', () => {
  it('успех — практика уходит из userPractices', async () => {
    const api = makeApi({
      getPractices: vi.fn().mockResolvedValue([{ id: 1, text: 'Своя' }]),
    });
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    await waitFor(() => expect(result.current.userPractices.length).toBe(1));
    await act(async () => {
      result.current.handleDeletePractice(1);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.userPractices.length).toBe(0));
  });

  it('повторный клик по уже удаляемому id — no-op (deletePractice не зовётся снова)', async () => {
    let resolveDelete!: () => void;
    const api = makeApi({
      getPractices: vi.fn().mockResolvedValue([{ id: 1, text: 'Своя' }]),
      deletePractice: vi.fn().mockReturnValue(
        new Promise<void>((r) => {
          resolveDelete = r;
        }),
      ),
    });
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    await waitFor(() => expect(result.current.userPractices.length).toBe(1));
    act(() => result.current.handleDeletePractice(1));
    act(() => result.current.handleDeletePractice(1));
    expect(api.deletePractice).toHaveBeenCalledTimes(1);
    resolveDelete();
  });

  it('сбой deletePractice — практика остаётся, deletingIds откатывается (можно повторить)', async () => {
    const api = makeApi({
      getPractices: vi.fn().mockResolvedValue([{ id: 1, text: 'Своя' }]),
      deletePractice: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    await waitFor(() => expect(result.current.userPractices.length).toBe(1));
    await act(async () => {
      result.current.handleDeletePractice(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.userPractices.length).toBe(1);
    expect(result.current.deletingIds.has(1)).toBe(false);
  });
});

describe('usePlanSheetState — handleSave', () => {
  it('новый текст — добавляет практику, создаёт план с UTC-часом из локального+смещения, вызывает onSaved', async () => {
    const api = makeApi();
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, onSaved),
    );
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());
    act(() => result.current.selectText('Новая практика'));
    act(() => result.current.setReminderIdx(0)); // Утром, 9:00
    await act(async () => {
      await result.current.handleSave();
    });
    expect(api.addPractice).toHaveBeenCalledWith(
      'attachment',
      'Новая практика',
    );
    expect(api.createPlan).toHaveBeenCalledWith(
      'attachment',
      'Новая практика',
      expect.any(Number),
    );
    expect(result.current.savedOk).toBe(true);
  });

  it('без напоминания (localHour=null) — reminderUtcHour не передаётся', async () => {
    const noReminderIdx = REMINDER_OPTIONS.findIndex(
      (o) => o.localHour === null,
    );
    const api = makeApi();
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    act(() => result.current.selectText('Практика'));
    act(() => result.current.setReminderIdx(noReminderIdx));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(api.createPlan).toHaveBeenCalledWith(
      'attachment',
      'Практика',
      undefined,
    );
  });

  it('уже своя практика — не зовёт addPractice повторно', async () => {
    const api = makeApi({
      getPractices: vi
        .fn()
        .mockResolvedValue([{ id: 1, text: 'Своя практика' }]),
    });
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    await waitFor(() => expect(result.current.userPractices.length).toBe(1));
    act(() => result.current.selectText('Своя практика'));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(api.addPractice).not.toHaveBeenCalled();
    expect(api.createPlan).toHaveBeenCalled();
  });

  it('сбой createPlan — saveError=true, savedOk остаётся false', async () => {
    const api = makeApi({
      createPlan: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    act(() => result.current.selectText('Практика'));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(result.current.saveError).toBe(true);
    expect(result.current.savedOk).toBe(false);
  });

  it('успех — onSaved зовётся через 1200мс (не сразу, чтобы юзер увидел галочку)', async () => {
    vi.useFakeTimers();
    const api = makeApi();
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, onSaved),
    );
    act(() => result.current.selectText('Практика'));
    await act(async () => {
      await result.current.handleSave();
    });
    expect(onSaved).not.toHaveBeenCalled();
    void act(() => vi.advanceTimersByTime(1200));
    expect(onSaved).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('без выбранного текста — no-op', async () => {
    const api = makeApi();
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', api, vi.fn()),
    );
    await act(async () => {
      await result.current.handleSave();
    });
    expect(api.createPlan).not.toHaveBeenCalled();
  });
});

describe('usePlanSheetState — handleIcsDownload', () => {
  it('зовёт getHost().saveFile с data: url и именем practice.ics', () => {
    const { result } = renderHook(() =>
      usePlanSheetState('attachment', 'Привязанность', makeApi(), vi.fn()),
    );
    act(() => result.current.selectText('Практика'));
    act(() => result.current.handleIcsDownload());
    expect(saveFile).toHaveBeenCalledWith(
      expect.stringContaining('data:text/calendar'),
      'practice.ics',
    );
  });
});
