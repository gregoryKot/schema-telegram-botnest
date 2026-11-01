// @vitest-environment jsdom
// Даты сессий и имя клиента в карточке терапевта (оба фронта). Инцидент
// 2026-10-26 (docs/INCIDENTS.md, класс 19): ответ сохранения возвращал в
// карточку прежнего клиента, если терапевт уже перешёл к другому. Сценарии
// через фасады — в useClientDetail.switch.test.ts обоих фронтендов; здесь —
// сам хук.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useSessionAliasEditing } from './useSessionAliasEditing';
import type { TherapyClientSummary } from '../types';
import type { UserId } from '../userId';

afterEach(() => vi.useRealTimers());

const client = (
  id: number,
  o: Partial<TherapyClientSummary> = {},
): TherapyClientSummary => ({
  telegramId: id,
  name: `К${id}`,
  clientAlias: null,
  streak: 0,
  lastActiveDate: null,
  todayIndex: null,
  recentIndexHistory: [],
  relationCreatedAt: '2026-01-01T00:00:00Z',
  therapyStartDate: null,
  nextSession: null,
  meetingDays: [],
  schemaIds: [],
  ...o,
});

function setup(opts: { fail?: boolean; clearAfterMs?: number } = {}) {
  const ref = { current: 1 as UserId | null };
  const renameClient = vi.fn(async () => {
    if (opts.fail) throw new Error('x');
  });
  const updateSessionInfo = vi.fn(async () => {
    if (opts.fail) throw new Error('x');
  });
  const view = renderHook(() => {
    const [selectedClient, setSelectedClient] =
      useState<TherapyClientSummary | null>(client(1));
    const [clients, setClients] = useState<TherapyClientSummary[]>([
      client(1),
      client(2),
    ]);
    const edit = useSessionAliasEditing({
      selectedClient,
      setSelectedClient,
      setClients,
      openClientIdRef: ref,
      send: { renameClient, updateSessionInfo },
      sessionError: {
        text: 'Не удалось сохранить дату',
        clearAfterMs: opts.clearAfterMs,
      },
    });
    return { edit, selectedClient, clients, setSelectedClient };
  });
  return { ...view, ref, renameClient, updateSessionInfo };
}

describe('useSessionAliasEditing — имя клиента', () => {
  it('сохраняет имя открытому клиенту: карточка и список обновлены, поле закрыто', async () => {
    const { result, renameClient } = setup();
    act(() => {
      result.current.edit.setRenamingAlias(true);
      result.current.edit.setAliasInput('  Анна  ');
    });
    await act(() => result.current.edit.saveAlias());
    expect(renameClient).toHaveBeenCalledWith(1, '  Анна  ');
    expect(result.current.selectedClient?.clientAlias).toBe('Анна');
    expect(result.current.clients[0].clientAlias).toBe('Анна');
    expect(result.current.edit.renamingAlias).toBe(false);
    expect(result.current.edit.aliasSaving).toBe(false);
  });

  it('пустое имя сбрасывает псевдоним в null', async () => {
    const { result } = setup();
    act(() => result.current.edit.setAliasInput('   '));
    await act(() => result.current.edit.saveAlias());
    expect(result.current.selectedClient?.clientAlias).toBeNull();
  });

  it('сбой — ошибка у открытого клиента, поле остаётся открытым', async () => {
    const { result } = setup({ fail: true });
    act(() => result.current.edit.setRenamingAlias(true));
    await act(() => result.current.edit.saveAlias());
    expect(result.current.edit.aliasError).toBe('Не удалось сохранить имя');
    expect(result.current.edit.renamingAlias).toBe(true);
  });

  it('сбой после перехода к другому клиенту — его карточка ошибки не видит', async () => {
    const { result, ref } = setup({ fail: true });
    ref.current = 2;
    await act(() => result.current.edit.saveAlias());
    expect(result.current.edit.aliasError).toBe('');
  });

  it('ответ после перехода не возвращает прежнего клиента в карточку', async () => {
    const { result, ref } = setup();
    act(() => result.current.edit.setAliasInput('Анна'));
    const saving = result.current.edit.saveAlias();
    ref.current = 2;
    act(() => result.current.setSelectedClient(client(2)));
    await act(() => saving);
    expect(result.current.selectedClient?.telegramId).toBe(2);
    expect(result.current.clients[0].clientAlias).toBe('Анна');
  });

  it('без выбранного клиента ничего не отправляет', async () => {
    const { result, renameClient, updateSessionInfo } = setup();
    act(() => result.current.setSelectedClient(null));
    await act(() => result.current.edit.saveAlias());
    let ok = true;
    await act(async () => {
      ok = await result.current.edit.saveSessionInfo({ nextSession: null });
    });
    expect(ok).toBe(false);
    expect(renameClient).not.toHaveBeenCalled();
    expect(updateSessionInfo).not.toHaveBeenCalled();
  });
});

describe('useSessionAliasEditing — даты сессий', () => {
  it('сохраняет дни встреч и дату: исход true, карточка и список обновлены', async () => {
    const { result, updateSessionInfo } = setup();
    let ok = false;
    await act(async () => {
      ok = await result.current.edit.saveSessionInfo({
        meetingDays: [6],
        nextSession: '2026-10-31T07:00',
      });
    });
    expect(ok).toBe(true);
    expect(updateSessionInfo).toHaveBeenCalledWith(1, {
      meetingDays: [6],
      nextSession: '2026-10-31T07:00',
    });
    expect(result.current.selectedClient?.meetingDays).toEqual([6]);
    expect(result.current.clients[0].nextSession).toBe('2026-10-31T07:00');
    expect(result.current.edit.sessionInfoSaving).toBe(false);
  });

  it('сбой — исход false и текст ошибки; с clearAfterMs ошибка снимается сама', async () => {
    vi.useFakeTimers();
    const { result } = setup({ fail: true, clearAfterMs: 3000 });
    let ok = true;
    await act(async () => {
      ok = await result.current.edit.saveSessionInfo({
        therapyStartDate: '2026-01-01',
      });
    });
    expect(ok).toBe(false);
    expect(result.current.edit.sessionInfoError).toBe(
      'Не удалось сохранить дату',
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.edit.sessionInfoError).toBe('');
  });

  it('без clearAfterMs ошибка висит до следующей попытки', async () => {
    const { result } = setup({ fail: true });
    await act(() =>
      result.current.edit.saveSessionInfo({ therapyStartDate: null }),
    );
    expect(result.current.edit.sessionInfoError).toBe(
      'Не удалось сохранить дату',
    );
  });

  it('сбой после перехода к другому клиенту — false без ошибки в чужой карточке', async () => {
    const { result, ref } = setup({ fail: true });
    ref.current = 2;
    let ok = true;
    await act(async () => {
      ok = await result.current.edit.saveSessionInfo({ nextSession: null });
    });
    expect(ok).toBe(false);
    expect(result.current.edit.sessionInfoError).toBe('');
  });

  it('resetSessionAlias сбрасывает черновики и флаги и берёт даты нового клиента', async () => {
    const { result } = setup({ fail: true });
    act(() => {
      result.current.edit.setRenamingAlias(true);
      result.current.edit.setAliasInput('черновик');
      result.current.edit.setEditingStartDate(true);
      result.current.edit.setEditingNextSession(true);
      result.current.edit.setEditingDays(true);
    });
    await act(() => result.current.edit.saveAlias());
    act(() =>
      result.current.edit.resetSessionAlias(
        client(2, {
          meetingDays: [1, 3],
          nextSession: '2026-11-02T10:00',
          therapyStartDate: '2025-09-24',
        }),
      ),
    );
    const e = result.current.edit;
    expect([
      e.renamingAlias,
      e.editingStartDate,
      e.editingNextSession,
      e.editingDays,
    ]).toEqual([false, false, false, false]);
    expect(e.aliasInput).toBe('');
    expect(e.aliasError).toBe('');
    expect(e.localMeetingDays).toEqual([1, 3]);
    expect(e.localNextSession).toBe('2026-11-02T10:00');
    expect(e.localStartDate).toBe('2025-09-24');
  });

  it('resetSessionAlias с пустыми датами — пустые черновики', () => {
    const { result } = setup();
    act(() =>
      result.current.edit.resetSessionAlias({
        ...client(2),
        meetingDays: undefined as unknown as number[],
      }),
    );
    expect(result.current.edit.localMeetingDays).toEqual([]);
    expect(result.current.edit.localNextSession).toBe('');
    expect(result.current.edit.localStartDate).toBe('');
  });
});
