// E11 аудита 2026-11: напоминание плана практики приходило не в тот день.
// План — на завтра по поясу человека, а момент считался от UTC-даты сервера:
// Москва в 00:00–02:59 — на день раньше, Владивосток «Утром» — на день позже.
// Пояса заданы явно: от зоны процесса расчёт не зависит (джоба под Сиднеем).
import { planDay, planReminderAt } from './plan-reminder';

describe('planDay — завтра по календарю человека', () => {
  it.each([
    // 00:30 по Москве 8-го — в UTC ещё 7-е
    ['Europe/Moscow', '2026-11-07T21:30:00Z', '2026-11-09'],
    // 20:00 во Владивостоке 8-го
    ['Asia/Vladivostok', '2026-11-08T10:00:00Z', '2026-11-09'],
    // 22:00 в Нью-Йорке 8-го — в UTC уже 9-е
    ['America/New_York', '2026-11-09T03:00:00Z', '2026-11-09'],
    ['Asia/Kolkata', '2026-11-08T18:45:00Z', '2026-11-10'],
  ])('%s, сейчас %s → %s', (tz, now, day) => {
    expect(planDay(tz, new Date(now))).toBe(day);
  });
});

describe('planReminderAt — местный час клиента', () => {
  it.each([
    ['Europe/Moscow', 9, '2026-11-09T06:00:00.000Z'],
    // 9 местного = 23 UTC накануне: тот же местный день плана
    ['Asia/Vladivostok', 9, '2026-11-08T23:00:00.000Z'],
    ['America/New_York', 9, '2026-11-09T14:00:00.000Z'],
    ['America/New_York', 19, '2026-11-10T00:00:00.000Z'],
    // получасовой пояс: 9:00 по Калькутте — 03:30 UTC, а не 03:00
    ['Asia/Kolkata', 9, '2026-11-09T03:30:00.000Z'],
  ])('%s, %i:00 дня плана → %s', (tz, localHour, at) => {
    expect(planReminderAt('2026-11-09', tz, { localHour })?.toISOString()).toBe(
      at,
    );
  });

  it('день перехода на летнее время: 9:00 по Нью-Йорку уже по EDT', () => {
    expect(
      planReminderAt('2027-03-14', 'America/New_York', {
        localHour: 9,
      })?.toISOString(),
    ).toBe('2027-03-14T13:00:00.000Z');
  });

  it('пришли оба часа — главный местный', () => {
    expect(
      planReminderAt('2026-11-09', 'Europe/Moscow', {
        localHour: 9,
        utcHour: 20,
      })?.toISOString(),
    ).toBe('2026-11-09T06:00:00.000Z');
  });

  it('без часа (и с null) — напоминания нет', () => {
    expect(planReminderAt('2026-11-09', 'Europe/Moscow', {})).toBeNull();
    expect(
      planReminderAt('2026-11-09', 'Europe/Moscow', {
        localHour: null,
        utcHour: null,
      }),
    ).toBeNull();
  });
});

describe('planReminderAt — час UTC от старого клиента', () => {
  it.each([
    // старый клиент: 9 местного − смещение = час UTC
    ['Europe/Moscow', 6, '2026-11-09T06:00:00.000Z'],
    ['Asia/Vladivostok', 23, '2026-11-08T23:00:00.000Z'],
    ['America/New_York', 14, '2026-11-09T14:00:00.000Z'],
    ['America/New_York', 0, '2026-11-10T00:00:00.000Z'],
  ])('%s, %i UTC → момент внутри дня плана: %s', (tz, utcHour, at) => {
    expect(planReminderAt('2026-11-09', tz, { utcHour })?.toISOString()).toBe(
      at,
    );
  });
});
