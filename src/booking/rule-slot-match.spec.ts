// Прямые тесты ruleOffersSlot — «правило предлагает ровно этот слот»
// (rule-slot-match.ts). Заменил ruleCoversSlot (availability-window.ts,
// удалён): тот проверял только «интервал влезает в окно», и POST /book
// принимал любую длину и старт вне сетки (аудит 2026-11). Через
// assertWithinAvailability те же случаи — booking.availability*.spec.ts.
import { ruleOffersSlot, OfferingRule } from './rule-slot-match';

// Понедельник, окно 10:30–18:45 МСК (ненулевые минуты), слоты по 15 мин без
// перерыва: 10:30, 10:45, … 18:30.
const RULE: OfferingRule = {
  dayOfWeek: 1,
  startHour: 10,
  startMinute: 30,
  endHour: 18,
  endMinute: 45,
  sessionDuration: 15,
  bufferMin: 0,
  timezone: 'Europe/Moscow',
};
const at = (iso: string) => new Date(iso);

describe('ruleOffersSlot — границы окна', () => {
  it('за минуту до открытия (10:29 МСК) — false', () => {
    expect(ruleOffersSlot(RULE, at('2026-07-13T07:29:00Z'), 15)).toBe(false);
  });

  it('ровно в момент открытия (10:30) — true', () => {
    expect(ruleOffersSlot(RULE, at('2026-07-13T07:30:00Z'), 15)).toBe(true);
  });

  it('последний слот кончается ровно в закрытие (18:30 + 15 = 18:45) — true', () => {
    expect(ruleOffersSlot(RULE, at('2026-07-13T15:30:00Z'), 15)).toBe(true);
  });

  it('слот 18:45 кончался бы за окном — false', () => {
    expect(ruleOffersSlot(RULE, at('2026-07-13T15:45:00Z'), 15)).toBe(false);
  });
});

describe('ruleOffersSlot — сетка и длина', () => {
  // Сетка с перерывом: 50 мин + 10 — слоты 10:00, 11:00, … 18:00.
  const HOURLY: OfferingRule = {
    ...RULE,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    sessionDuration: 50,
    bufferMin: 10,
  };

  it('слот сетки с длиной sessionDuration — true', () => {
    expect(ruleOffersSlot(HOURLY, at('2026-07-13T09:00:00Z'), 50)).toBe(true);
  });

  it('тот же старт, длина 180 или 15 — false: такого слота нет', () => {
    expect(ruleOffersSlot(HOURLY, at('2026-07-13T09:00:00Z'), 180)).toBe(false);
    expect(ruleOffersSlot(HOURLY, at('2026-07-13T09:00:00Z'), 15)).toBe(false);
  });

  it('старт в перерыве или между слотами (11:50, 12:30) — false', () => {
    expect(ruleOffersSlot(HOURLY, at('2026-07-13T08:50:00Z'), 50)).toBe(false);
    expect(ruleOffersSlot(HOURLY, at('2026-07-13T09:30:00Z'), 50)).toBe(false);
  });
});

describe('ruleOffersSlot — день недели по зоне правила', () => {
  it('тот же час, но вторник вместо понедельника — false', () => {
    expect(ruleOffersSlot(RULE, at('2026-07-14T09:00:00Z'), 15)).toBe(false);
  });

  it('правильный день и слот — true', () => {
    expect(ruleOffersSlot(RULE, at('2026-07-13T09:00:00Z'), 15)).toBe(true);
  });

  it('местный понедельник 23:00 в Нью-Йорке (вт 03:00 UTC) — true', () => {
    const ny: OfferingRule = {
      ...RULE,
      startHour: 22,
      startMinute: 0,
      endHour: 23,
      endMinute: 30,
      timezone: 'America/New_York',
    };
    expect(ruleOffersSlot(ny, at('2026-07-14T03:00:00Z'), 15)).toBe(true);
  });
});
