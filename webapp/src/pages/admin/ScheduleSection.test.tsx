// @vitest-environment jsdom
// «Расписание»: недельные правила (переехало из BookingSection.test.tsx —
// ScheduleManager вынесен в ScheduleSection.tsx, правило №10 CLAUDE.md) +
// встроенный календарь недели. CalendarWeek рендерится ВСЕГДА, поэтому
// api.adminCalendar замокан в каждом тесте — иначе useAsyncData внутри
// упадёт на вызове .then() у undefined.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScheduleSection } from './ScheduleSection';
import type { AvailabilityRule } from '../../api';

vi.mock('../../api', () => ({
  api: {
    adminCreateRule: vi.fn(),
    adminToggleRule: vi.fn(),
    adminDeleteRule: vi.fn(),
    adminCalendar: vi.fn(),
    adminSetOverrides: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function rule(overrides: Partial<AvailabilityRule> = {}): AvailabilityRule {
  return {
    id: 1, dayOfWeek: 1, startHour: 10, startMinute: 0, endHour: 19, endMinute: 0,
    sessionDuration: 50, bufferMin: 10, timezone: 'Europe/Moscow', isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.adminCalendar.mockResolvedValue({
    timezone: 'Europe/Moscow', calendarConnected: false, calendarBlocking: false, calendarReadError: null, days: [],
  });
});

afterEach(() => cleanup());

describe('ScheduleSection — недельные правила', () => {
  it('без правил — подсказка добавить слоты, а не пустой список без объяснения', async () => {
    render(<ScheduleSection rules={[]} rulesFailed={false} onChange={() => {}} adminKey="k" />);
    await screen.findByText('Пока нет правил. Добавьте слоты ниже.');
  });

  it('сбой ≠ пусто: отказ загрузки правил показывает ошибку, а не «Пока нет правил»', async () => {
    render(<ScheduleSection rules={[]} rulesFailed onChange={() => {}} adminKey="wrong" />);
    expect(await screen.findByText(/Не удалось загрузить расписание/)).toBeTruthy();
    expect(screen.queryByText('Пока нет правил. Добавьте слоты ниже.')).toBeNull();
  });

  it('показывает существующее правило человеческим текстом', async () => {
    render(<ScheduleSection rules={[rule()]} rulesFailed={false} onChange={() => {}} adminKey="k" />);
    await screen.findByText(/10:00–19:00 · 50 мин \(\+10\)/);
  });

  it('добавление правила вызывает API с введёнными параметрами', async () => {
    mockApi.adminCreateRule.mockResolvedValue({ id: 2 });
    render(<ScheduleSection rules={[]} rulesFailed={false} onChange={() => {}} adminKey="k" />);
    await screen.findByText('Пока нет правил. Добавьте слоты ниже.');
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(mockApi.adminCreateRule).toHaveBeenCalledWith('k', {
      dayOfWeek: 1, startHour: 10, startMinute: 0, endHour: 19, endMinute: 0,
      sessionDuration: 50, bufferMin: 10,
    });
  });

  it('выключенное правило показано полупрозрачным, кнопка предлагает включить', async () => {
    render(<ScheduleSection rules={[rule({ id: 1, dayOfWeek: 2, startHour: 9, endHour: 12, isActive: false })]} rulesFailed={false} onChange={() => {}} adminKey="k" />);
    await screen.findByRole('button', { name: 'Вкл' });
  });

  it('удаление правила вызывает adminDeleteRule', async () => {
    mockApi.adminDeleteRule.mockResolvedValue(undefined);
    render(<ScheduleSection rules={[rule({ id: 7, dayOfWeek: 3, startHour: 9, endHour: 12 })]} rulesFailed={false} onChange={() => {}} adminKey="k" />);
    await screen.findByLabelText('Удалить правило');
    fireEvent.click(screen.getByLabelText('Удалить правило'));
    expect(mockApi.adminDeleteRule).toHaveBeenCalledWith('k', 7);
  });
});

describe('ScheduleSection — календарь недели', () => {
  it('рендерит календарь недели внутри секции «Расписание»', async () => {
    mockApi.adminCalendar.mockResolvedValue({
      timezone: 'Europe/Moscow',
      calendarConnected: false,
      calendarBlocking: false,
      calendarReadError: null,
      days: [{ date: '2026-09-21', cells: [{ startsAt: '2026-09-21T07:00:00.000Z', durationMin: 50, state: 'free', busy: false, past: false }] }],
    });
    render(<ScheduleSection rules={[]} rulesFailed={false} onChange={() => {}} adminKey="k" />);
    expect(screen.getByText('Расписание')).toBeTruthy();
    expect(await screen.findByLabelText('10:00 — свободно')).toBeTruthy();
  });
});
