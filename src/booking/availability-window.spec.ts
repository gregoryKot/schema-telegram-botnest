// Прямые тесты ruleCoversSlot — вынесенного тела rules.some(...) из
// booking.availability.ts. booking.availability.boundary.spec.ts уже
// проверял эти границы косвенно через assertWithinAvailability; здесь —
// та же арифметика без обвязки БД/исключений.
import { ruleCoversSlot, RuleWindow } from './availability-window';

// Понедельник, окно 10:30–18:45 МСК (ненулевые минуты).
const RULE: RuleWindow = {
  dayOfWeek: 1,
  startHour: 10,
  startMinute: 30,
  endHour: 18,
  endMinute: 45,
  timezone: 'Europe/Moscow',
};

describe('ruleCoversSlot — границы окна', () => {
  it('за минуту до открытия — false', () => {
    // 10:29 МСК = 07:29 UTC
    expect(ruleCoversSlot(RULE, new Date('2026-07-13T07:29:00Z'), 15)).toBe(
      false,
    );
  });

  it('ровно в момент открытия — true (граница включительно)', () => {
    expect(ruleCoversSlot(RULE, new Date('2026-07-13T07:30:00Z'), 15)).toBe(
      true,
    );
  });

  it('сессия заканчивается ровно в момент закрытия — true', () => {
    // старт 18:30 МСК + 15 мин = 18:45 МСК, конец окна.
    expect(ruleCoversSlot(RULE, new Date('2026-07-13T15:30:00Z'), 15)).toBe(
      true,
    );
  });

  it('сессия заканчивается на минуту позже закрытия — false', () => {
    expect(ruleCoversSlot(RULE, new Date('2026-07-13T15:30:00Z'), 16)).toBe(
      false,
    );
  });
});

describe('ruleCoversSlot — чужой день недели', () => {
  it('тот же час, но вторник вместо понедельника — false', () => {
    expect(ruleCoversSlot(RULE, new Date('2026-07-14T09:00:00Z'), 15)).toBe(
      false,
    );
  });

  it('правильный день и час — true', () => {
    expect(ruleCoversSlot(RULE, new Date('2026-07-13T09:00:00Z'), 15)).toBe(
      true,
    );
  });
});
