// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { TherapistNote } from '../../api';

const getTherapyPlan = vi.hoisted(() => vi.fn());
const plain = vi.hoisted(() => ({ fail: false, asked: 0 }));
// Отказ отдаёт обычная функция: шпион vitest на отклонённом промисе роняет тест необработанным отказом.
vi.mock('../../api', () => ({ api: { getTherapyPlan: (id: number) => (plain.fail ? (plain.asked += 1, Promise.reject(new Error('сеть'))) : getTherapyPlan(id)) } }));
import { useSessionPlanTitles } from './useSessionPlanTitles';

const note = (id: number, planItemIds?: number[]) => ({ id, planItemIds }) as unknown as TherapistNote;

describe('useSessionPlanTitles — названия пунктов плана для записей сессий', () => {
  beforeEach(() => { getTherapyPlan.mockReset(); plain.fail = false; plain.asked = 0; });

  it('без отметок в записях план не запрашивается', () => {
    const { result } = renderHook(() => useSessionPlanTitles(7, [note(1), note(2, [])]));
    expect(getTherapyPlan).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it('есть отметка — названия подтянулись по id', async () => {
    getTherapyPlan.mockResolvedValue([{ id: 5, text: 'Диалог с Критиком' }]);
    const { result } = renderHook(() => useSessionPlanTitles(7, [note(1, [5])]));
    await waitFor(() => expect(result.current.get(5)).toBe('Диалог с Критиком'));
    expect(getTherapyPlan).toHaveBeenCalledWith(7);
  });

  it('сбой загрузки — пустая карта', async () => {
    plain.fail = true;
    const { result } = renderHook(() => useSessionPlanTitles(7, [note(1, [5])]));
    await waitFor(() => expect(plain.asked).toBe(1));
    expect(result.current.size).toBe(0);
  });
});
