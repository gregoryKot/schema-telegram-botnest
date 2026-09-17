// Граничные случаи «активного ядра» — задача из docs/LAUNCH_STRATEGY.md §5:
// пользователи с ≥3 разными днями дневника за последние 7. Ключевое отличие
// от простого COUNT — считаем РАЗНЫЕ ДНИ, а не число записей, и окно строго
// [sinceDate, ...) по датам-строкам.
import { countActiveCore } from './active-core-metrics';

describe('countActiveCore', () => {
  it('2 разных дня — ещё не ядро', () => {
    const rows = [
      { userId: 1n, date: '2026-08-10' },
      { userId: 1n, date: '2026-08-11' },
    ];
    expect(countActiveCore(rows, '2026-08-06')).toBe(0);
  });

  it('3 разных дня — уже ядро', () => {
    const rows = [
      { userId: 1n, date: '2026-08-10' },
      { userId: 1n, date: '2026-08-11' },
      { userId: 1n, date: '2026-08-12' },
    ];
    expect(countActiveCore(rows, '2026-08-06')).toBe(1);
  });

  it('3 записи в один день — НЕ ядро (считаем разные дни, а не количество записей)', () => {
    const rows = [
      { userId: 1n, date: '2026-08-10' },
      { userId: 1n, date: '2026-08-10' },
      { userId: 1n, date: '2026-08-10' },
    ];
    expect(countActiveCore(rows, '2026-08-06')).toBe(0);
  });

  it('запись 8-дневной давности не учитывается (граница окна)', () => {
    // sinceDate = день, ровно на 7 дней раньше «сегодня» 2026-08-13 — тот же
    // способ, каким getAdminStats считает week7Count/todayCount (localDate,
    // gte). Запись за 8 дней до «сегодня» старше этой границы.
    const sinceDate = '2026-08-06'; // today (2026-08-13) - 7 дней
    const rows = [
      { userId: 1n, date: '2026-08-05' }, // today - 8 дней: вне окна
      { userId: 1n, date: sinceDate }, // ровно на границе: в окне
      { userId: 1n, date: '2026-08-07' },
    ];
    // Без старой записи у юзера только 2 дня в окне — не ядро. Если бы
    // восьмидневная запись всё же учитывалась, было бы 3 дня → результат 1.
    expect(countActiveCore(rows, sinceDate)).toBe(0);
  });

  it('несколько пользователей — считает только тех, кто перешёл порог, не всех', () => {
    const rows = [
      { userId: 1n, date: '2026-08-10' },
      { userId: 1n, date: '2026-08-11' },
      { userId: 1n, date: '2026-08-12' }, // юзер 1: 3 дня — ядро
      { userId: 2n, date: '2026-08-10' },
      { userId: 2n, date: '2026-08-11' }, // юзер 2: 2 дня — не ядро
      { userId: 3n, date: '2026-08-06' }, // юзер 3: 1 день — не ядро
    ];
    expect(countActiveCore(rows, '2026-08-06')).toBe(1);
  });

  it('пустой список строк — 0, а не падение/NaN', () => {
    expect(countActiveCore([], '2026-08-06')).toBe(0);
  });

  it('minDays настраивается (по умолчанию 3)', () => {
    const rows = [
      { userId: 1n, date: '2026-08-10' },
      { userId: 1n, date: '2026-08-11' },
    ];
    expect(countActiveCore(rows, '2026-08-06', 2)).toBe(1);
    expect(countActiveCore(rows, '2026-08-06', 3)).toBe(0);
  });
});
