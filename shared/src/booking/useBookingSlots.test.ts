// @vitest-environment jsdom
// Загрузка слотов записи — общая для публичной записи и записи клиента из
// приложения (#546): дубли выкинуты, сбой ≠ «слотов нет», день по умолчанию —
// в зоне посетителя.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { firstSlotDay, uniqueSlots, useBookingSlots } from './useBookingSlots';
import { forEachTimeZone } from '../utils/timeZone.test-helpers';

const slot = (startsAt: string) => ({ startsAt, durationMin: 50 });

describe('uniqueSlots', () => {
  it('выкидывает повтор startsAt, порядок сохраняет (инцидент 2026-09-29)', () => {
    const a = slot('2026-11-09T07:00:00.000Z');
    const b = slot('2026-11-09T09:00:00.000Z');
    expect(uniqueSlots([a, b, { ...a }])).toEqual([a, b]);
  });
});

describe('firstSlotDay', () => {
  it('нет слотов или ещё грузится — пустой день', () => {
    expect(firstSlotDay(null, 'Europe/Moscow')).toBe('');
    expect(firstSlotDay([], 'Europe/Moscow')).toBe('');
  });

  it('день первого слота — в зоне посетителя, а не по Москве', () => {
    const late = [slot('2026-11-09T21:30:00.000Z')]; // 00:30 Мск 10-го, 04:30 в Бангкоке
    expect(firstSlotDay(late, 'Europe/Moscow')).toBe('2026-11-10');
    expect(firstSlotDay(late, 'America/New_York')).toBe('2026-11-09');
  });

  it('ответ не зависит от зоны машины', () => {
    forEachTimeZone(() => {
      expect(
        firstSlotDay([slot('2026-11-09T21:30:00.000Z')], 'Asia/Bangkok'),
      ).toBe('2026-11-10');
    });
  });
});

describe('useBookingSlots', () => {
  it('грузит, затем отдаёт слоты без дублей', async () => {
    const a = slot('2026-11-09T07:00:00.000Z');
    const load = vi.fn().mockResolvedValue([a, a]);
    const { result } = renderHook(() => useBookingSlots(load));
    expect(result.current).toEqual({ slots: null, failed: false });
    await waitFor(() => expect(result.current.slots).toEqual([a]));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('сбой загрузки — failed, а не пустой список («свободного времени нет» было бы неправдой)', async () => {
    const load = vi.fn().mockRejectedValue(new Error('502'));
    const { result } = renderHook(() => useBookingSlots(load));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.slots).toBeNull();
  });
});
