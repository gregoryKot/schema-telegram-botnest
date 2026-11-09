// @vitest-environment jsdom
// История трекера: сбой ≠ пусто. До 2026-11 промис истории в AppShell шёл без
// catch (нашёл no-floating-promises, когда правило включили в webapp): отказ
// сети рисовал пустую историю, будто записей нет, и уходил unhandled rejection.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTrackerHistory } from './useTrackerHistory';

const history = vi.fn();
const reportClientError = vi.fn();
vi.mock('../../api', () => ({
  api: { history: (...a: unknown[]) => history(...a) },
  reportClientError: (...a: unknown[]) => reportClientError(...a),
}));

const day = (date: string) => ({ date, ratings: { attachment: 7 }, index: 7 });

beforeEach(() => { vi.clearAllMocks(); });

const open = (tab: string) => renderHook(({ t }) => useTrackerHistory(t, 30), { initialProps: { t: tab } });

describe('useTrackerHistory', () => {
  it('вкладка «Сегодня» — историю не грузит', () => {
    const { result } = open('today');
    expect(history).not.toHaveBeenCalled();
    expect(result.current.historyLoading).toBe(false);
  });

  it('открыли «Историю» — скелетон с того же рендера, потом дни; сбоя нет', async () => {
    let done!: (d: unknown) => void;
    history.mockReturnValue(new Promise((r) => { done = r; }));
    const hook = open('today');
    hook.rerender({ t: 'history' });
    expect(hook.result.current.historyLoading).toBe(true);
    expect(history).toHaveBeenCalledWith(30);
    await act(async () => { done([day('2026-11-01')]); });
    expect(hook.result.current.historyLoading).toBe(false);
    expect(hook.result.current.historyFailed).toBe(false);
    expect(hook.result.current.history.some((d) => d.date === '2026-11-01')).toBe(true);
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('сервер отказал — historyFailed (лист скажет «не загрузилось»), отчёт наверх', async () => {
    history.mockRejectedValue(new Error('503'));
    const hook = open('today');
    await act(async () => { hook.rerender({ t: 'history' }); });
    expect(hook.result.current.historyLoading).toBe(false);
    expect(hook.result.current.historyFailed).toBe(true);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ section: 'tracker.history' }));
  });

  it('повторное открытие вкладки после сбоя сбрасывает его и грузит заново', async () => {
    history.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([day('2026-11-02')]);
    const hook = open('today');
    await act(async () => { hook.rerender({ t: 'history' }); });
    expect(hook.result.current.historyFailed).toBe(true);
    hook.rerender({ t: 'today' });
    await act(async () => { hook.rerender({ t: 'history' }); });
    expect(history).toHaveBeenCalledTimes(2);
    expect(hook.result.current.historyFailed).toBe(false);
    expect(hook.result.current.history.some((d) => d.date === '2026-11-02')).toBe(true);
  });

  it('лист перечитал историю сам (оценка задним числом) — сбой снят', async () => {
    history.mockRejectedValue(new Error('503'));
    const hook = open('today');
    await act(async () => { hook.rerender({ t: 'history' }); });
    act(() => { hook.result.current.onHistoryRefreshed([day('2026-11-03')]); });
    expect(hook.result.current.historyFailed).toBe(false);
    expect(hook.result.current.history).toEqual([day('2026-11-03')]);
  });
});
