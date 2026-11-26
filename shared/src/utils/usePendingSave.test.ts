// @vitest-environment jsdom
// Общая механика отложенного автосохранения (инцидент 2026-10-26,
// docs/INCIDENTS.md): ключ и данные уходят только вместе, правка с другим
// ключом досылает прежнюю, уход со страницы досылает сразу.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  createPendingSave,
  usePendingSave,
  type PendingSaveOptions,
} from './usePendingSave';

type Send = PendingSaveOptions<number | string, string>['send'];
let send: ReturnType<typeof vi.fn<Send>>;
let onLeaveError: ReturnType<typeof vi.fn<(e: unknown) => void>>;
const options = (): PendingSaveOptions<number | string, string> => ({
  delayMs: 700,
  send,
  onLeaveError,
});

beforeEach(() => {
  send = vi.fn<Send>();
  onLeaveError = vi.fn<(e: unknown) => void>();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createPendingSave', () => {
  it('серия правок одного ключа — одна отправка последнего значения после задержки', () => {
    const saver = createPendingSave(options);
    saver.schedule(1, 'а');
    vi.advanceTimersByTime(500);
    saver.schedule(1, 'аб');
    vi.advanceTimersByTime(699);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send.mock.calls).toEqual([[1, 'аб', { leaving: false }]]);
  });

  it('правка другого ключа сначала досылает прежний ключ с ЕГО данными', () => {
    const saver = createPendingSave(options);
    saver.schedule(1, 'данные первого');
    saver.schedule(2, 'данные второго');
    expect(send.mock.calls).toEqual([
      [1, 'данные первого', { leaving: false }],
    ]);
    vi.advanceTimersByTime(700);
    expect(send.mock.calls[1]).toEqual([
      2,
      'данные второго',
      { leaving: false },
    ]);
  });

  it('ключи сравниваются isSameKey: 1 и "1" — один владелец, досылки нет', () => {
    const saver = createPendingSave<number | string, string>(() => ({
      ...options(),
      isSameKey: (a, b) => String(a) === String(b),
    }));
    saver.schedule(1, 'а');
    saver.schedule('1', 'аб');
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(send.mock.calls).toEqual([['1', 'аб', { leaving: false }]]);
  });

  it('flush отправляет сразу и снимает таймер; без ожидающего — ничего', () => {
    const saver = createPendingSave(options);
    saver.flush();
    expect(send).not.toHaveBeenCalled();
    saver.schedule(1, 'а');
    saver.flush();
    vi.advanceTimersByTime(2000);
    expect(send.mock.calls).toEqual([[1, 'а', { leaving: false }]]);
  });

  it('leave отправляет как досылку при уходе; отказ — в onLeaveError, синхронный бросок тоже', async () => {
    const saver = createPendingSave(options);
    send.mockRejectedValueOnce(new Error('network'));
    saver.schedule(1, 'а');
    saver.leave();
    expect(send.mock.calls).toEqual([[1, 'а', { leaving: true }]]);
    await vi.runAllTimersAsync();
    expect(onLeaveError).toHaveBeenCalledTimes(1);

    send.mockImplementationOnce(() => {
      throw new Error('sync');
    });
    saver.schedule(2, 'б');
    expect(() => saver.leave()).not.toThrow();
    expect(onLeaveError).toHaveBeenCalledTimes(2);
  });
});

describe('usePendingSave', () => {
  it('pagehide досылает ожидающее как уход', () => {
    const { result } = renderHook(() => usePendingSave(options()));
    act(() => result.current.schedule(1, 'а'));
    window.dispatchEvent(new Event('pagehide'));
    expect(send.mock.calls).toEqual([[1, 'а', { leaving: true }]]);
  });

  it('visibilitychange досылает только когда вкладка скрыта', () => {
    const { result } = renderHook(() => usePendingSave(options()));
    act(() => result.current.schedule(1, 'а'));
    document.dispatchEvent(new Event('visibilitychange')); // jsdom: visible
    expect(send).not.toHaveBeenCalled();
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    try {
      document.dispatchEvent(new Event('visibilitychange'));
    } finally {
      visibility.mockRestore();
    }
    expect(send.mock.calls).toEqual([[1, 'а', { leaving: true }]]);
  });

  it('размонтирование досылает ожидающее; без правок — ничего, и слушатели сняты', () => {
    const first = renderHook(() => usePendingSave(options()));
    act(() => first.result.current.schedule(1, 'а'));
    first.unmount();
    expect(send.mock.calls).toEqual([[1, 'а', { leaving: true }]]);

    const second = renderHook(() => usePendingSave(options()));
    second.unmount();
    window.dispatchEvent(new Event('pagehide'));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('отправка берёт send текущего рендера, а не первого', () => {
    const late = vi.fn<Send>();
    const { result, rerender } = renderHook(
      ({ s }) => usePendingSave({ ...options(), send: s }),
      {
        initialProps: { s: send },
      },
    );
    rerender({ s: late });
    act(() => result.current.schedule(1, 'а'));
    vi.advanceTimersByTime(700);
    expect(send).not.toHaveBeenCalled();
    expect(late).toHaveBeenCalledWith(1, 'а', { leaving: false });
  });
});
