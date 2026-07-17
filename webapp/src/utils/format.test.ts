// Тест объединённой версии format.ts (правило №3 CLAUDE.md, волна 2 —
// webapp/format.ts и schema-miniapp/format.ts были почти-парой, различались
// только форматированием кода; единственная копия теперь в shared/src/utils).
import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateLong, todayStr } from './format';

describe('fmtDate', () => {
  it('форматирует дату коротко, без сдвига таймзоны', () => {
    expect(fmtDate('2026-04-07')).toBe('7 апр');
    expect(fmtDate('2026-12-31')).toBe('31 дек');
    expect(fmtDate('2026-01-01')).toBe('1 янв');
  });
});

describe('fmtDateLong', () => {
  it('форматирует дату полным названием месяца', () => {
    expect(fmtDateLong('2026-04-07')).toBe('7 апреля');
    expect(fmtDateLong('2026-12-31')).toBe('31 декабря');
    expect(fmtDateLong('2026-01-01')).toBe('1 января');
  });
});

describe('todayStr', () => {
  it('возвращает сегодняшнюю дату в формате YYYY-MM-DD', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    expect(todayStr()).toBe(`${y}-${m}-${d}`);
  });
});
