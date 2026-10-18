// @vitest-environment jsdom
// usePairMechanics — единственная реализация логики механики «пара» для обоих
// фронтендов (правило №11 CLAUDE.md). Покрывает объединённое поведение двух
// прежних копий: загрузка и повтор, создание приглашения (провал обязан быть
// видимым — check-silent-catch), вступление по коду, выход с видимой ошибкой,
// перезагрузка при смене reloadKey, onInviteCreated.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePairMechanics, type PairApi } from './usePairMechanics';
import type { PairsData } from '../apiTypes';

const EMPTY: PairsData = { partners: [], pendingCode: null };
const URL1 = 'https://t.me/bot?startapp=pair_AB12';

const api = {
  getPair: vi.fn(),
  createPairInvite: vi.fn(),
  joinPair: vi.fn(),
  leavePair: vi.fn(),
} satisfies Record<keyof PairApi, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  api.getPair.mockResolvedValue(EMPTY);
});

async function ready(options = {}) {
  const hook = renderHook(
    (p: { reloadKey?: unknown }) =>
      usePairMechanics(api, { ...options, reloadKey: p.reloadKey }),
    { initialProps: {} as { reloadKey?: unknown } },
  );
  await waitFor(() => expect(hook.result.current.data).toEqual(EMPTY));
  return hook;
}

describe('загрузка', () => {
  it('успех кладёт данные в data', async () => {
    const { result } = await ready();
    expect(result.current.loadError).toBe(false);
  });

  it('провал выставляет loadError, шлёт отчёт и не подставляет пустоту', async () => {
    api.getPair.mockRejectedValue(new Error('network down'));
    const reportError = vi.fn();
    const { result } = renderHook(() => usePairMechanics(api, { reportError }));
    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.data).toBeNull();
    expect(reportError).toHaveBeenCalledWith('pair load failed');
  });

  it('retryLoad после сбоя подтягивает данные и снимает ошибку', async () => {
    api.getPair.mockRejectedValueOnce(new Error('x'));
    const { result } = renderHook(() => usePairMechanics(api));
    await waitFor(() => expect(result.current.loadError).toBe(true));
    act(() => result.current.retryLoad());
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));
    expect(result.current.loadError).toBe(false);
  });

  it('смена reloadKey (роли) перезагружает пару', async () => {
    const { rerender } = await ready();
    expect(api.getPair).toHaveBeenCalledTimes(1);
    rerender({ reloadKey: 'THERAPIST' });
    await waitFor(() => expect(api.getPair).toHaveBeenCalledTimes(2));
  });
});

describe('создание приглашения', () => {
  it('успех сохраняет code/url, перегружает пару, зовёт onInviteCreated', async () => {
    api.createPairInvite.mockResolvedValue({ code: 'AB12', url: URL1 });
    const onInviteCreated = vi.fn();
    const { result } = await ready({ onInviteCreated });

    await act(async () => {
      await result.current.handleCreateInvite();
    });

    expect(result.current.inviteCode).toBe('AB12');
    expect(result.current.inviteUrl).toBe(URL1);
    expect(result.current.createError).toBe(false);
    expect(onInviteCreated).toHaveBeenCalledWith('AB12', URL1);
    expect(api.getPair).toHaveBeenCalledTimes(2);
  });

  it('провал выставляет createError, шлёт отчёт, не зовёт onInviteCreated', async () => {
    api.createPairInvite.mockRejectedValue(new Error('network'));
    const onInviteCreated = vi.fn();
    const reportError = vi.fn();
    const { result } = await ready({ onInviteCreated, reportError });

    await act(async () => {
      await result.current.handleCreateInvite();
    });

    expect(result.current.createError).toBe(true);
    expect(result.current.inviteUrl).toBe('');
    expect(onInviteCreated).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith('pair create invite failed');
    expect(result.current.loading).toBe(false);
  });
});

describe('вступление по коду', () => {
  it('пустой код не уходит в api.joinPair', async () => {
    const { result } = await ready();
    await act(async () => {
      await result.current.handleJoin();
    });
    expect(api.joinPair).not.toHaveBeenCalled();
  });

  it('успех: код в верхнем регистре, возврат в main, код сброшен', async () => {
    api.joinPair.mockResolvedValue(undefined);
    const { result } = await ready();
    act(() => result.current.setJoinView('join'));
    act(() => result.current.setJoinCode(' ab12 '));
    await act(async () => {
      await result.current.handleJoin();
    });
    expect(api.joinPair).toHaveBeenCalledWith('AB12');
    expect(result.current.joinView).toBe('main');
    expect(result.current.joinCode).toBe('');
    expect(result.current.joinError).toBe(false);
  });

  it('провал выставляет joinError и остаётся на экране ввода', async () => {
    api.joinPair.mockRejectedValue(new Error('not found'));
    const { result } = await ready();
    act(() => result.current.setJoinView('join'));
    act(() => result.current.setJoinCode('ZZZZ'));
    await act(async () => {
      await result.current.handleJoin();
    });
    expect(result.current.joinError).toBe(true);
    expect(result.current.joinView).toBe('join');
  });
});

describe('выход из пары', () => {
  it('успех перезагружает пару и сбрасывает confirmLeaveCode', async () => {
    api.leavePair.mockResolvedValue(undefined);
    const { result } = await ready();
    act(() => result.current.setConfirmLeaveCode('CODE1'));
    await act(async () => {
      await result.current.handleLeave('CODE1');
    });
    expect(api.leavePair).toHaveBeenCalledWith('CODE1');
    expect(result.current.confirmLeaveCode).toBeNull();
    expect(result.current.leaveError).toBe(false);
    expect(api.getPair).toHaveBeenCalledTimes(2);
  });

  it('провал виден: leaveError + отчёт, подтверждение закрыто, пара не перезагружалась', async () => {
    api.leavePair.mockRejectedValue(new Error('network down'));
    const reportError = vi.fn();
    const { result } = await ready({ reportError });
    act(() => result.current.setConfirmLeaveCode('CODE1'));
    await act(async () => {
      await result.current.handleLeave('CODE1');
    });
    expect(result.current.leaveError).toBe(true);
    expect(result.current.confirmLeaveCode).toBeNull();
    expect(reportError).toHaveBeenCalledWith('pair leave failed');
    expect(api.getPair).toHaveBeenCalledTimes(1);
  });

  it('повторная попытка снимает прежнюю ошибку', async () => {
    api.leavePair.mockRejectedValueOnce(new Error('x'));
    api.leavePair.mockResolvedValueOnce(undefined);
    const { result } = await ready();
    await act(async () => {
      await result.current.handleLeave('C');
    });
    expect(result.current.leaveError).toBe(true);
    await act(async () => {
      await result.current.handleLeave('C');
    });
    expect(result.current.leaveError).toBe(false);
  });
});
