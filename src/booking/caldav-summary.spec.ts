// readSummary — раз-экранирование SUMMARY (RFC 5545), зеркало escapeText
// (см. caldav-event.util.spec.ts «escapedSummaryLine»). Событие уже
// unfolded к моменту вызова — построчный unfold тестируется в caldav-busy.spec.ts.
import { readSummary } from './caldav-summary';

function vevent(lines: string): string {
  return `BEGIN:VEVENT\n${lines}\nEND:VEVENT`;
}

describe('readSummary — обычные случаи', () => {
  it('SUMMARY без параметров — текст как есть', () => {
    expect(readSummary(vevent('SUMMARY:Встреча с клиентом'))).toBe(
      'Встреча с клиентом',
    );
  });

  it('SUMMARY с параметром (SUMMARY;LANGUAGE=ru:…) — параметр отбрасывается', () => {
    expect(readSummary(vevent('SUMMARY;LANGUAGE=ru:Планёрка'))).toBe(
      'Планёрка',
    );
  });
});

describe('readSummary — раз-экранирование спецсимволов (RFC 5545)', () => {
  it('\\, → запятая, \\; → точка с запятой, \\\\ → обратный слэш, \\n → пробел, всё сразу', () => {
    expect(readSummary(vevent('SUMMARY:a\\\\b\\;c\\,d\\ne'))).toBe(
      'a\\b;c,d e',
    );
  });

  it('\\N (заглавная) тоже раскрывается как перенос строки — в пробел', () => {
    expect(readSummary(vevent('SUMMARY:часть1\\Nчасть2'))).toBe(
      'часть1 часть2',
    );
  });

  it('несколько пробелов, образовавшихся после раз-экранирования, схлопываются в один', () => {
    expect(readSummary(vevent('SUMMARY:часть1 \\nчасть2'))).toBe(
      'часть1 часть2',
    );
  });
});

describe('readSummary — пустое и отсутствующее значение', () => {
  it('SUMMARY: без текста — undefined', () => {
    expect(readSummary(vevent('SUMMARY:'))).toBeUndefined();
  });

  it('SUMMARY из одних пробелов — undefined после trim', () => {
    expect(readSummary(vevent('SUMMARY:   '))).toBeUndefined();
  });

  it('поля SUMMARY нет вовсе — undefined', () => {
    expect(readSummary(vevent('DTSTART:20260713T170000Z'))).toBeUndefined();
  });
});

describe('readSummary — обрезка длинных названий', () => {
  it('длиннее 120 символов — обрезается до 120 + «…»', () => {
    const long = 'a'.repeat(150);
    const out = readSummary(vevent(`SUMMARY:${long}`));
    expect(out).toBe(`${'a'.repeat(120)}…`);
    expect(out).toHaveLength(121);
  });

  it('ровно 120 символов — не обрезается, многоточие не добавляется', () => {
    const exact = 'b'.repeat(120);
    expect(readSummary(vevent(`SUMMARY:${exact}`))).toBe(exact);
  });
});
