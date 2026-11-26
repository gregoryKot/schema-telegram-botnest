// @vitest-environment jsdom
// Автопоказ «Зачем это всё»: один раз, только когда экран готов и в аккаунте
// пусто; закрытие ставит флаг, который уходит в синхронизацию prefs.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { EntryFlowsDoneContext } from '../../components/appShell/entryQueue';

const notify = vi.fn();
const trackEvent = vi.fn();
vi.mock('../../utils/uiPrefsSync', () => ({ notifyPrefsChanged: () => notify() }));
vi.mock('../../api', () => ({ api: { trackEvent: (...a: unknown[]) => trackEvent(...a) } }));

import { useWhySheet } from './useWhySheet';
import { WHY_SEEN_KEY, isWhySeen, markWhySeen } from './whySeen';

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('whySeen', () => {
  it('флаг пишется в localStorage и сообщает синхронизатору', () => {
    expect(isWhySeen()).toBe(false);
    markWhySeen();
    expect(localStorage.getItem(WHY_SEEN_KEY)).toBe('1');
    expect(isWhySeen()).toBe(true);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('ключ — тот, что бэк пропускает в prefs (why_seen_v1)', () => {
    expect(WHY_SEEN_KEY).toBe('why_seen_v1');
  });
});

describe('useWhySheet', () => {
  it('не готов — не открывается; стал готов — открывается автоматически один раз', () => {
    const { result, rerender } = renderHook((p) => useWhySheet(p), { initialProps: { ready: false, hasHistory: false } });
    expect(result.current.mode).toBeNull();
    rerender({ ready: true, hasHistory: false });
    expect(result.current.mode).toBe('auto');
    act(() => result.current.close());
    expect(result.current.mode).toBeNull();
    rerender({ ready: true, hasHistory: false });
    expect(result.current.mode).toBeNull();
  });

  it('флаг уже стоит или в аккаунте есть данные — сам не открывается', () => {
    markWhySeen();
    expect(renderHook(() => useWhySheet({ ready: true, hasHistory: false })).result.current.mode).toBeNull();
    localStorage.clear();
    expect(renderHook(() => useWhySheet({ ready: true, hasHistory: true })).result.current.mode).toBeNull();
  });

  it('вручную: open → manual и событие why, close ставит флаг', () => {
    markWhySeen();
    const { result } = renderHook(() => useWhySheet({ ready: true, hasHistory: false }));
    act(() => result.current.open());
    expect(result.current.mode).toBe('manual');
    expect(trackEvent).toHaveBeenCalledWith('home_tile', { tile: 'why' });
    act(() => result.current.close());
    expect(result.current.mode).toBeNull();
  });
});

// QA 2026-11 (A-З7): автопоказ открывался поверх согласий и вопроса «ты/вы» —
// новичок видел три слоя сразу. Теперь он ждёт конца очереди входов (EntryFlows).
describe('useWhySheet — ждёт конца очереди входов', () => {
  function withQueue(done: { current: boolean }) {
    return ({ children }: { children: ReactNode }) =>
      createElement(EntryFlowsDoneContext.Provider, { value: done.current }, children);
  }

  it('экран готов, но очередь не кончилась — листа нет; кончилась — открывается сам', () => {
    const done = { current: false };
    const { result, rerender } = renderHook(() => useWhySheet({ ready: true, hasHistory: false }), { wrapper: withQueue(done) });
    expect(result.current.mode).toBeNull();
    done.current = true;
    rerender();
    expect(result.current.mode).toBe('auto');
  });

  it('контрольный: очередь кончилась, но в аккаунте есть данные — сам не открывается', () => {
    const done = { current: true };
    const { result } = renderHook(() => useWhySheet({ ready: true, hasHistory: true }), { wrapper: withQueue(done) });
    expect(result.current.mode).toBeNull();
  });
});
