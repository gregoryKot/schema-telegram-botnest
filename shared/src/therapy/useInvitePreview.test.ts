// @vitest-environment jsdom
// Предпросмотр приглашения на экране согласия (инцидент 2026-10-26): имя
// терапевта — только с сервера; 400 — код не действует; прочий сбой —
// «неизвестно», экран работает как раньше.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInvitePreview } from './useInvitePreview';

describe('useInvitePreview', () => {
  it('живой код → имя терапевта', async () => {
    const preview = vi.fn().mockResolvedValue({ therapistName: 'Анна' });
    const { result } = renderHook(() =>
      useInvitePreview(preview, 'CODE', true),
    );
    expect(result.current).toEqual({ state: 'loading' });
    await waitFor(() =>
      expect(result.current).toEqual({ state: 'ok', therapistName: 'Анна' }),
    );
    expect(preview).toHaveBeenCalledWith('CODE');
  });

  it('400 → invalid', async () => {
    const preview = vi.fn().mockRejectedValue({ status: 400 });
    const { result } = renderHook(() =>
      useInvitePreview(preview, 'CODE', true),
    );
    await waitFor(() => expect(result.current).toEqual({ state: 'invalid' }));
  });

  it('сеть/500 → unknown, а не «код не действует»', async () => {
    const preview = vi.fn().mockRejectedValue(new Error('net'));
    const { result } = renderHook(() =>
      useInvitePreview(preview, 'CODE', true),
    );
    await waitFor(() => expect(result.current).toEqual({ state: 'unknown' }));
  });

  it('выключен (приглашение в пару) — сеть не зовётся', () => {
    const preview = vi.fn();
    const { result } = renderHook(() =>
      useInvitePreview(preview, 'CODE', false),
    );
    expect(preview).not.toHaveBeenCalled();
    expect(result.current).toEqual({ state: 'unknown' });
  });
});
