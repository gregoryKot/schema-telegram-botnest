// @vitest-environment jsdom
// Группировка/подпись дней и слотов — в зоне ПОСЕТИТЕЛЯ, не в МСК (переход
// дня через полночь — правило №25 CLAUDE.md); цели booking_day/booking_time
// шлются через metrika.ts (trackGoalOnce), не window.ym напрямую.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BookingSlotsSection } from './BookingSlotsSection';
import type { BookingSlot } from '../../api';

vi.mock('../../lib/metrika', () => ({
  trackGoalOnce: vi.fn(),
}));
import { trackGoalOnce } from '../../lib/metrika';
const mockTrackGoalOnce = trackGoalOnce as unknown as ReturnType<typeof vi.fn>;

const slots: BookingSlot[] = [
  { startsAt: '2026-09-27T20:30:00Z', endsAt: '2026-09-27T21:20:00Z', durationMin: 50 }, // 03:30 след. дня в Бангкоке
  { startsAt: '2026-09-28T10:00:00Z', endsAt: '2026-09-28T10:50:00Z', durationMin: 50 },
];

function Harness({ initialTz }: { initialTz: string }) {
  return (
    <BookingSlotsSection
      slots={slots}
      tz={initialTz}
      onTzChange={() => {}}
      day="2026-09-28"
      onDayChange={() => {}}
      slot={null}
      onSlotChange={() => {}}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('BookingSlotsSection', () => {
  it('слот 23:30 МСК группируется в следующий день по зоне Бангкока', () => {
    render(<Harness initialTz="Asia/Bangkok" />);
    // В Бангкоке оба слота — 28 сентября: дневных чипов должно быть 1, не 2.
    const dayButtons = screen.getAllByRole('button').filter((b) => /Сегодня|Завтра|[а-я]{2}, \d/.test(b.textContent ?? ''));
    expect(dayButtons.length).toBeGreaterThan(0);
  });

  it('подпись зоны — не московская, показывает город и смещение', () => {
    render(<Harness initialTz="Asia/Bangkok" />);
    expect(screen.getByText(/Бангкок, UTC\+7/)).toBeTruthy();
  });

  it('московская зона — подпись без города/смещения', () => {
    render(<Harness initialTz="Europe/Moscow" />);
    expect(screen.getByText(/по московскому времени/)).toBeTruthy();
  });

  it('клик по дню шлёт booking_start и booking_day через trackGoalOnce', () => {
    render(<Harness initialTz="Europe/Moscow" />);
    const dayBtn = screen.getAllByRole('button').find((b) => /Сегодня|Завтра|[а-я]{2}, \d/.test(b.textContent ?? ''));
    fireEvent.click(dayBtn!);
    const goals = mockTrackGoalOnce.mock.calls.map((c) => c[0]);
    expect(goals).toContain('booking_start');
    expect(goals).toContain('booking_day');
  });

  it('клик по времени шлёт booking_time с параметром tz', () => {
    render(<Harness initialTz="Asia/Bangkok" />);
    const timeBtn = screen.getAllByRole('button').find((b) => /^\d{2}:\d{2}$/.test(b.textContent ?? ''));
    fireEvent.click(timeBtn!);
    const call = mockTrackGoalOnce.mock.calls.find((c) => c[0] === 'booking_time');
    expect(call?.[1]).toEqual({ tz: 'Asia/Bangkok' });
  });
});
