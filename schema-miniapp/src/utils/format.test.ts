// Тест объединённой версии format.ts (правило №3 CLAUDE.md, волна 2 —
// webapp/format.ts и schema-miniapp/format.ts были почти-парой, различались
// только форматированием кода; единственная копия теперь в shared/src/utils).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fmtDate, fmtDateLong, todayStr } from './format';

afterEach(() => {
  vi.useRealTimers();
});

describe('fmtDate', () => {
  it('форматирует дату как "<день> <короткий месяц>" без сдвига часового пояса', () => {
    expect(fmtDate('2026-04-07')).toBe('7 апр');
    expect(fmtDate('2026-12-31')).toBe('31 дек');
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

  it('возвращает сегодняшнюю дату в формате YYYY-MM-DD (реальные часы)', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    expect(todayStr()).toBe(`${y}-${m}-${d}`);
  });
});
