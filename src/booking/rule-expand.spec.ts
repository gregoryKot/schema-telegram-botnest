// Развёртка AvailabilityRule в слоты дня — ровно та арифметика, что раньше
// жила инлайн в SlotService.getSlots (slot.service.spec.ts её уже проверял
// косвенно, через прогон всего сервиса). Здесь — прямые тесты чистой функции,
// плюс weekdayOf/addDaysToDateString, которых раньше не было отдельно.
import {
  expandRuleForDay,
  weekdayOf,
  addDaysToDateString,
  ExpandableRule,
} from './rule-expand';

const RULE_9_18: ExpandableRule = {
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  sessionDuration: 50,
  bufferMin: 10,
  timezone: 'Europe/Moscow',
};

describe('expandRuleForDay — базовая развёртка', () => {
  it('понедельник 09–18 МСК, 50+10 мин — слоты 09..17 по часам (9 штук)', () => {
    const slots = expandRuleForDay(RULE_9_18, '2026-07-13');
    // 09:00 МСК = 06:00 UTC (MSK = UTC+3).
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-07-13T06:00:00.000Z',
      '2026-07-13T07:00:00.000Z',
      '2026-07-13T08:00:00.000Z',
      '2026-07-13T09:00:00.000Z',
      '2026-07-13T10:00:00.000Z',
      '2026-07-13T11:00:00.000Z',
      '2026-07-13T12:00:00.000Z',
      '2026-07-13T13:00:00.000Z',
      '2026-07-13T14:00:00.000Z',
    ]);
    expect(slots[0].endsAt.toISOString()).toBe('2026-07-13T06:50:00.000Z');
  });

  it('полуоткрытый конец: слот, вылезающий за окно, не создаётся', () => {
    // Окно 09:00–17:10 UTC (timezone: UTC — проще проверять границу без
    // офсета зоны). Последний кандидат 17:00+50=17:50 > 17:10 — отсекается.
    const rule: ExpandableRule = {
      ...RULE_9_18,
      timezone: 'UTC',
      endHour: 17,
      endMinute: 10,
    };
    const slots = expandRuleForDay(rule, '2026-07-13');
    expect(slots.at(-1)?.startsAt.toISOString()).toBe(
      '2026-07-13T16:00:00.000Z',
    );
    expect(
      slots.some(
        (s) => s.startsAt.toISOString() === '2026-07-13T17:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('ненулевые startMinute/endMinute: окно 10:30–11:30 UTC, 50 мин без буфера — один слот', () => {
    const rule: ExpandableRule = {
      startHour: 10,
      startMinute: 30,
      endHour: 11,
      endMinute: 30,
      sessionDuration: 50,
      bufferMin: 0,
      timezone: 'UTC',
    };
    const slots = expandRuleForDay(rule, '2026-07-13');
    expect(slots).toHaveLength(1);
    expect(slots[0].startsAt.toISOString()).toBe('2026-07-13T10:30:00.000Z');
    expect(slots[0].endsAt.toISOString()).toBe('2026-07-13T11:20:00.000Z');
  });

  it('день без слотов (окно короче сессии) — пустой массив, не исключение', () => {
    const rule: ExpandableRule = { ...RULE_9_18, endHour: 9, endMinute: 30 };
    expect(expandRuleForDay(rule, '2026-07-13')).toEqual([]);
  });
});

describe('expandRuleForDay — DST (America/New_York)', () => {
  it('ДО перехода на летнее время — офсет EST (UTC-5)', () => {
    const rule: ExpandableRule = {
      ...RULE_9_18,
      startHour: 10,
      endHour: 11,
      timezone: 'America/New_York',
    };
    // 2026-03-01 — воскресенье, ещё EST (переход 2026-03-08).
    const slots = expandRuleForDay(rule, '2026-03-01');
    expect(slots).toHaveLength(1);
    expect(slots[0].startsAt.toISOString()).toBe('2026-03-01T15:00:00.000Z');
  });

  it('ПОСЛЕ перехода на летнее время — офсет EDT (UTC-4)', () => {
    const rule: ExpandableRule = {
      ...RULE_9_18,
      startHour: 10,
      endHour: 11,
      timezone: 'America/New_York',
    };
    const slots = expandRuleForDay(rule, '2026-03-15');
    expect(slots).toHaveLength(1);
    expect(slots[0].startsAt.toISOString()).toBe('2026-03-15T14:00:00.000Z');
  });
});

describe('weekdayOf', () => {
  it('понедельник 2026-07-13 → 1', () => {
    expect(weekdayOf('2026-07-13')).toBe(1);
  });
  it('воскресенье 2026-07-12 → 0', () => {
    expect(weekdayOf('2026-07-12')).toBe(0);
  });
});

describe('addDaysToDateString', () => {
  it('прибавляет сутки в пределах месяца', () => {
    expect(addDaysToDateString('2026-07-13', 1)).toBe('2026-07-14');
  });
  it('переходит через границу месяца', () => {
    expect(addDaysToDateString('2026-07-31', 1)).toBe('2026-08-01');
  });
  it('отрицательный сдвиг — назад', () => {
    expect(addDaysToDateString('2026-07-13', -1)).toBe('2026-07-12');
  });
});
