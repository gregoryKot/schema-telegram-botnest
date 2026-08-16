// @vitest-environment jsdom
// usePairMechanics — единственная реализация логики механики «пара»
// (правило №11 CLAUDE.md): загрузка, создание приглашения (успех/провал,
// regression: check-silent-catch — провал обязан быть видимым, не best-effort
// тишиной), вступление по коду (успех/провал/пустой код), отвязка,
// onInviteCreated — единственная точка расхождения двух поверхностей
// (PairSheet/PartnerSection), проверяем что коллбэк реально зовётся с кодом
// и ссылкой.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePairMechanics } from './usePairMechanics';
import type { PairsData } from '../../apiTypes';

vi.mock('../../api', () => ({
  api: {
    getPair: vi.fn(),
    createPairInvite: vi.fn(),
    joinPair: vi.fn(),
    leavePair: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const EMPTY: PairsData = { partners: [], pendingCode: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPair.mockResolvedValue(EMPTY);
});

describe('usePairMechanics — загрузка', () => {
  it('успех кладёт данные в data', async () => {
    const { result } = renderHook(() => usePairMechanics());
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));
    expect(result.current.loadError).toBe(false);
  });

  it('провал загрузки выставляет loadError, а не молчаливую пустоту', async () => {
    mockApi.getPair.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => usePairMechanics());
    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('usePairMechanics — создание приглашения', () => {
  it('успех сохраняет code/url, перегружает пару, зовёт onInviteCreated', async () => {
    mockApi.createPairInvite.mockResolvedValue({
      code: 'AB12',
      url: 'https://t.me/bot?startapp=pair_AB12',
    });
    const onInviteCreated = vi.fn();
    const { result } = renderHook(() => usePairMechanics(onInviteCreated));
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));

    await act(async () => {
      await result.current.handleCreateInvite();
    });

    expect(result.current.inviteCode).toBe('AB12');
    expect(result.current.inviteUrl).toBe(
      'https://t.me/bot?startapp=pair_AB12',
    );
    expect(result.current.createError).toBe(false);
    expect(onInviteCreated).toHaveBeenCalledWith(
      'AB12',
      'https://t.me/bot?startapp=pair_AB12',
    );
  });

  it('провал выставляет createError и НЕ зовёт onInviteCreated (не best-effort тишина)', async () => {
    mockApi.createPairInvite.mockRejectedValue(new Error('network'));
    const onInviteCreated = vi.fn();
    const { result } = renderHook(() => usePairMechanics(onInviteCreated));
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));

    await act(async () => {
      await result.current.handleCreateInvite();
    });

    expect(result.current.createError).toBe(true);
    expect(result.current.inviteUrl).toBe('');
    expect(onInviteCreated).not.toHaveBeenCalled();
  });
});

describe('usePairMechanics — вступление по коду', () => {
  it('пустой код не уходит в api.joinPair', async () => {
    const { result } = renderHook(() => usePairMechanics());
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));

    await act(async () => {
      await result.current.handleJoin();
    });
    expect(mockApi.joinPair).not.toHaveBeenCalled();
  });

  it('успех приводит код к верхнему регистру, перезагружает пару, возвращает в main', async () => {
    mockApi.joinPair.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePairMechanics());
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));

    act(() => result.current.setJoinCode('ab12'));
    await act(async () => {
      await result.current.handleJoin();
    });

    expect(mockApi.joinPair).toHaveBeenCalledWith('AB12');
    expect(result.current.joinView).toBe('main');
    expect(result.current.joinError).toBe(false);
  });

  it('провал выставляет joinError, а не тишину', async () => {
    mockApi.joinPair.mockRejectedValue(new Error('not found'));
    const { result } = renderHook(() => usePairMechanics());
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));

    act(() => result.current.setJoinCode('ZZZZ'));
    await act(async () => {
      await result.current.handleJoin();
    });

    expect(result.current.joinError).toBe(true);
  });
});

describe('usePairMechanics — отвязка', () => {
  it('успех перезагружает пару и сбрасывает confirmLeaveCode', async () => {
    mockApi.leavePair.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePairMechanics());
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));
    act(() => result.current.setConfirmLeaveCode('CODE1'));

    await act(async () => {
      await result.current.handleLeave('CODE1');
    });

    expect(mockApi.leavePair).toHaveBeenCalledWith('CODE1');
    expect(result.current.confirmLeaveCode).toBeNull();
  });

  it('провал не роняет хук и всё равно сбрасывает confirmLeaveCode', async () => {
    mockApi.leavePair.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => usePairMechanics());
    await waitFor(() => expect(result.current.data).toEqual(EMPTY));
    act(() => result.current.setConfirmLeaveCode('CODE1'));

    await act(async () => {
      await result.current.handleLeave('CODE1');
    });

    expect(result.current.confirmLeaveCode).toBeNull();
  });
});
