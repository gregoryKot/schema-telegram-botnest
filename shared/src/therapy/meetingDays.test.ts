import { describe, it, expect } from 'vitest';
import {
  MEETING_DAYS_ORDER,
  toggleMeetingDay,
  sortMeetingDays,
} from './meetingDays';

describe('meetingDays', () => {
  it('неделя начинается с понедельника, воскресенье (0) в конце', () => {
    expect([...MEETING_DAYS_ORDER]).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('toggleMeetingDay добавляет день и держит порядок недели', () => {
    expect(toggleMeetingDay([3], 1)).toEqual([1, 3]);
    expect(toggleMeetingDay([3], 0)).toEqual([3, 0]);
  });

  it('toggleMeetingDay снимает уже отмеченный день', () => {
    expect(toggleMeetingDay([1, 3, 0], 3)).toEqual([1, 0]);
    expect(toggleMeetingDay([2], 2)).toEqual([]);
  });

  it('toggleMeetingDay не мутирует входной массив', () => {
    const days = [1, 2];
    toggleMeetingDay(days, 5);
    expect(days).toEqual([1, 2]);
  });

  it('sortMeetingDays убирает дубли и значения вне 0–6', () => {
    expect(sortMeetingDays([0, 5, 5, 9, -1, 1])).toEqual([1, 5, 0]);
    expect(sortMeetingDays([])).toEqual([]);
  });
});
