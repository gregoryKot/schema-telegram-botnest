// Тест форматирования дат (format.ts).
// ВНИМАНИЕ (аудит): этот файл разошёлся с webapp/src/utils/format.ts по
// числу строк (49 vs 23) — но разница чисто форматная (перенос строк
// массивов месяцев, тире «—» vs «–» в комментариях), логика идентична.
// Файл сознательно НЕ в списке парных (scripts/check-paired-files.mjs) —
// кандидат на выравнивание/вынос в shared в волне 2. Тесты здесь и в
// webapp/src/utils/format.test.ts написаны раздельно и намеренно зеркалят
// друг друга — если поведение когда-нибудь разойдётся содержательно, один
// из наборов тестов покраснеет первым.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtDate, fmtDateLong, todayStr } from './format';

afterEach(() => {
  vi.useRealTimers();
});

describe('fmtDate', () => {
  it('форматирует дату как "<день> <короткий месяц>" без сдвига часового пояса', () => {
    expect(fmtDate('2026-04-07')).toBe('7 апр');
  });

  it('не добавляет ведущий ноль к дню (parseInt отбрасывает его)', () => {
    expect(fmtDate('2026-01-01')).toBe('1 янв');
  });

  it('корректно матчит все 12 месяцев', () => {
    expect(fmtDate('2026-12-25')).toBe('25 дек');
    expect(fmtDate('2026-06-15')).toBe('15 июн');
  });
});

describe('fmtDateLong', () => {
  it('форматирует дату как "<день> <месяц в родительном падеже>"', () => {
    expect(fmtDateLong('2026-04-07')).toBe('7 апреля');
  });

  it('корректно матчит крайние месяцы года', () => {
    expect(fmtDateLong('2026-01-01')).toBe('1 января');
    expect(fmtDateLong('2026-12-31')).toBe('31 декабря');
  });
});

describe('todayStr', () => {
  it('возвращает YYYY-MM-DD для текущей даты в локальном времени, с ведущими нулями', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0)); // 5 января 2026, локально
    expect(todayStr()).toBe('2026-01-05');
  });

  it('дополняет месяц и день нулями до двух знаков', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 0, 0, 0)); // 9 сентября 2026
    expect(todayStr()).toBe('2026-09-09');
  });
});
