// @vitest-environment jsdom
// Регрессия QA 2026-11-05 (живой стенд, прод-сборка): после «Отключиться от
// терапевта» в «Ещё» до перезагрузки висело «Написать терапевту» — ссылка на
// БЫВШЕГО терапевта; кэш контакта (therapistContact.ts) чистил только
// следующий старт. Зеркально: после подключения кодом мост не появлялся без
// перезагрузки (docs/open/therapy.md). Хук обязан обновлять кэш сам.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import type { TherapyRelationInfo } from '../../api';
import { useTherapyRelationSettings } from './useTherapyRelationSettings';
import {
  getTherapistContact,
  hasConnectedTherapist,
} from '../../../../shared/src/utils/therapistContact';
import { TASKS_CHANGED_EVENT } from '../../../../shared/src/tasks/tasksChanged';

vi.mock('../../api', () => ({
  api: {
    joinTherapy: vi.fn(),
    getTherapyRelation: vi.fn(),
    leaveTherapy: vi.fn(),
    createTherapyInvite: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const REL: TherapyRelationInfo = {
  role: 'client', status: 'active', partnerName: 'Анна', partnerId: 4300000000001,
  code: 'ABCDEF123456', nextSession: null, meetingDays: [],
};

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(AddressFormContext.Provider, { value: { form: 'ty', setForm: vi.fn() } }, children);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useTherapyRelationSettings — кэш «Написать терапевту»', () => {
  it('подключение кодом: связь в состоянии и кэш контакта без перезагрузки', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(REL);
    mockApi.joinTherapy.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTherapyRelationSettings('CLIENT'), { wrapper });
    act(() => result.current.join.setCode('abcdef123456'));
    await act(async () => { await result.current.join.submit(); });
    expect(mockApi.joinTherapy).toHaveBeenCalledWith('ABCDEF123456');
    await waitFor(() => expect(result.current.join.joined).toBe(true));
    expect(hasConnectedTherapist()).toBe(true);
    expect(getTherapistContact().url).toBe('tg://user?id=4300000000001');
  });

  it('отключение после подтверждения: связи нет и кэш очищен — мост ведёт к автору', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(REL);
    mockApi.leaveTherapy.mockResolvedValue(undefined);
    localStorage.setItem('therapy_contact_url', 'tg://user?id=4300000000001');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    const { result } = renderHook(() => useTherapyRelationSettings('CLIENT'), { wrapper });
    await waitFor(() => expect(result.current.therapyRelation).toEqual(REL));
    expect(hasConnectedTherapist()).toBe(true);
    act(() => result.current.leave.ask());
    await act(async () => { await result.current.leave.confirm(); });
    expect(mockApi.leaveTherapy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.therapyRelation).toBeNull());
    expect(hasConnectedTherapist()).toBe(false);
    expect(getTherapistContact().name).toBe('автору');
  });

  // 2026-11-05: открытые задания бывшего терапевта стали личными целями —
  // «Сегодня» под листом перечитывает список, метка «От терапевта» уходит.
  it('отключение сообщает экранам со списком заданий; отказ сервера — нет', async () => {
    const heard = vi.fn();
    window.addEventListener(TASKS_CHANGED_EVENT, heard);
    mockApi.getTherapyRelation.mockResolvedValue(REL);
    mockApi.leaveTherapy.mockRejectedValueOnce(new Error('500'));
    const { result } = renderHook(() => useTherapyRelationSettings('CLIENT'), { wrapper });
    await waitFor(() => expect(result.current.therapyRelation).toEqual(REL));
    act(() => result.current.leave.ask());
    await act(async () => { await result.current.leave.confirm(); });
    expect(heard).not.toHaveBeenCalled();
    mockApi.leaveTherapy.mockResolvedValue(undefined);
    act(() => result.current.leave.ask());
    await act(async () => { await result.current.leave.confirm(); });
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(TASKS_CHANGED_EVENT, heard);
  });

  it('отказ сервера при отключении: связь и кэш не тронуты', async () => {
    mockApi.getTherapyRelation.mockResolvedValue(REL);
    mockApi.leaveTherapy.mockRejectedValue(new Error('500'));
    localStorage.setItem('therapy_contact_url', 'tg://user?id=4300000000001');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    const { result } = renderHook(() => useTherapyRelationSettings('CLIENT'), { wrapper });
    await waitFor(() => expect(result.current.therapyRelation).toEqual(REL));
    act(() => result.current.leave.ask());
    await act(async () => { await result.current.leave.confirm(); });
    expect(result.current.leave.failed).toBe(true);
    expect(result.current.therapyRelation).toEqual(REL);
    expect(hasConnectedTherapist()).toBe(true);
  });
});
