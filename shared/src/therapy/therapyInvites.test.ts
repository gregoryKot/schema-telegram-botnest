// @vitest-environment jsdom
// Живые приглашения терапевта (инцидент 2026-10-26): загрузка, сбой ≠ пусто,
// отзыв убирает строку; отказ отзыва — ошибка у строки и перечитывание.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  inviteCreateErrorText,
  usePendingInvites,
  type TherapyInvite,
} from './therapyInvites';

const inv = (id: number, alias: string | null = null): TherapyInvite => ({
  id,
  code: `CODE${id}`.padEnd(12, '0'),
  url: `https://t.me/x?startapp=therapy_${id}`,
  alias,
  createdAt: '2026-10-26T10:00:00.000Z',
  expiresAt: '2026-11-02T10:00:00.000Z',
});

function makeApi(list: TherapyInvite[]) {
  return {
    getTherapyInvites: vi.fn().mockResolvedValue(list),
    revokeTherapyInvite: vi.fn().mockResolvedValue(undefined),
  };
}

describe('usePendingInvites', () => {
  it('сначала undefined (грузится), потом список', async () => {
    const api = makeApi([inv(1, 'Мария К.')]);
    const { result } = renderHook(() => usePendingInvites(api));
    expect(result.current.invites).toBeUndefined();
    await waitFor(() =>
      expect(result.current.invites?.[0].alias).toBe('Мария К.'),
    );
  });

  it('сбой загрузки — null, а не пустой список', async () => {
    const api = makeApi([]);
    api.getTherapyInvites.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => usePendingInvites(api));
    await waitFor(() => expect(result.current.invites).toBeNull());
  });

  it('отзыв: один вызов с id, строка уходит из списка', async () => {
    const api = makeApi([inv(1), inv(2)]);
    const { result } = renderHook(() => usePendingInvites(api));
    await waitFor(() => expect(result.current.invites).toHaveLength(2));
    await act(() => result.current.revoke(1));
    expect(api.revokeTherapyInvite).toHaveBeenCalledWith(1);
    expect(result.current.invites?.map((i) => i.id)).toEqual([2]);
    expect(result.current.revokeFailed).toBeNull();
  });

  it('отказ отзыва — revokeFailed = id и список перечитывается', async () => {
    const api = makeApi([inv(1)]);
    api.revokeTherapyInvite.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => usePendingInvites(api));
    await waitFor(() => expect(result.current.invites).toHaveLength(1));
    await act(() => result.current.revoke(1));
    expect(result.current.revokeFailed).toBe(1);
    expect(api.getTherapyInvites).toHaveBeenCalledTimes(2);
  });

  it('reload — новое приглашение появляется без перезахода в кабинет', async () => {
    const api = makeApi([]);
    const { result } = renderHook(() => usePendingInvites(api));
    await waitFor(() => expect(result.current.invites).toEqual([]));
    api.getTherapyInvites.mockResolvedValue([inv(3, 'Пётр')]);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.invites).toHaveLength(1));
  });
});

describe('inviteCreateErrorText', () => {
  const ty = (a: string) => a;
  const vy = (_a: string, b: string) => b;

  it('предел живых приглашений — свой текст с выходом, в обеих формах', () => {
    const err = { status: 409, reason: 'too_many_invites' };
    expect(inviteCreateErrorText(err, ty)).toMatch(/Отзови ненужные/);
    expect(inviteCreateErrorText(err, vy)).toMatch(/Отзовите ненужные/);
  });

  it('прочее — общий текст', () => {
    expect(inviteCreateErrorText(new Error('x'), ty)).toMatch(
      /Не удалось создать приглашение/,
    );
    expect(inviteCreateErrorText(null, vy)).toMatch(/Попробуйте ещё раз/);
  });
});
