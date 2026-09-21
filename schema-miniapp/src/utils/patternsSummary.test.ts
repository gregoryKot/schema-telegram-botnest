// Тесты недельной сводки схем («Паттерны», волна 2 нейродизайна).
import { describe, it, expect } from 'vitest';
import {
  weekSchemaSummary,
  weekModeSummary,
  weekSchemaFrequency,
} from './patternsSummary';
import { forEachTimeZone } from '../../../shared/src/utils/timeZone.test-helpers';

const NOW = new Date('2026-07-17T20:00:00');
const entry = (iso: string, ids: string[]) => ({
  createdAt: iso,
  schemaIds: ids,
});

describe('weekSchemaFrequency', () => {
  it('id → число уникальных дней за неделю', () => {
    const freq = weekSchemaFrequency(
      [
        entry('2026-07-17T09:00:00', ['abandonment', 'mistrust']),
        entry('2026-07-17T21:00:00', ['abandonment']), // тот же день — не +1
        entry('2026-07-16T10:00:00', ['abandonment']),
        entry('2026-07-01T10:00:00', ['mistrust']), // старше 7 дней — вне окна
      ],
      NOW,
    );
    expect(freq).toEqual({ abandonment: 2, mistrust: 1 });
  });

  it('пусто — пустая карта', () => {
    expect(weekSchemaFrequency([], NOW)).toEqual({});
  });
});

describe('weekSchemaSummary', () => {
  it('нет записей — null', () => {
    expect(weekSchemaSummary([], NOW)).toBeNull();
  });

  it('считает уникальные дни, а не записи', () => {
    const res = weekSchemaSummary(
      [
        entry('2026-07-16T09:00:00', ['abandonment']),
        entry('2026-07-16T21:00:00', ['abandonment']),
        entry('2026-07-15T12:00:00', ['abandonment']),
      ],
      NOW,
    );
    expect(res).toEqual({
      id: 'abandonment',
      days: 2,
      windowDays: 7,
    });
  });

  it('топ выбирается по числу дней между схемами', () => {
    const res = weekSchemaSummary(
      [
        entry('2026-07-17T10:00:00', ['abandonment', 'mistrust']),
        entry('2026-07-16T10:00:00', ['mistrust']),
        entry('2026-07-15T10:00:00', ['mistrust']),
      ],
      NOW,
    );
    expect(res?.id).toBe('mistrust');
    expect(res?.days).toBe(3);
  });

  it('записи старше 7 дней не считаются', () => {
    const res = weekSchemaSummary(
      [
        entry('2026-07-01T10:00:00', ['abandonment']),
        entry('2026-07-17T10:00:00', ['mistrust']),
      ],
      NOW,
    );
    expect(res?.id).toBe('mistrust');
  });

  it('битые даты игнорируются', () => {
    expect(
      weekSchemaSummary([entry('мусор', ['abandonment'])], NOW),
    ).toBeNull();
  });

  it('режимы: один modeId на запись', () => {
    const res = weekModeSummary(
      [
        { createdAt: '2026-07-17T10:00:00', modeId: 'demanding_critic' },
        { createdAt: '2026-07-16T10:00:00', modeId: 'demanding_critic' },
        { createdAt: '2026-07-16T12:00:00', modeId: 'happy_child' },
      ],
      NOW,
    );
    expect(res).toEqual({
      id: 'demanding_critic',
      days: 2,
      windowDays: 7,
    });
  });
});

// ── Регрессия «день записи по Гринвичу» ──────────────────────────────────────
// Окно недели отсчитывается от ЛОКАЛЬНОЙ полуночи, а день записи брался
// срезом строки (`createdAt.slice(0, 10)`) — то есть по Гринвичу. Два вечера
// одного местного дня расходились на два «дня из семи», и наоборот. Проверка
// сама обходит зоны и не зависит от часа прогона: ожидание считается
// локальными геттерами Date, мимо самой сводки.
describe('weekFrequency — дни считаются в зоне читателя', () => {
  const PAIR = ['2026-09-18T23:30:00.000Z', '2026-09-19T00:30:00.000Z'];
  const NOW_PAIR = new Date('2026-09-19T01:00:00.000Z');
  const localDays = (isos: string[]) =>
    new Set(isos.map((iso) => new Date(iso).toDateString())).size;

  it('две записи одного местного дня — один день, в любой зоне', () => {
    forEachTimeZone((tz) => {
      const freq = weekSchemaFrequency(
        PAIR.map((iso) => entry(iso, ['abandonment'])),
        NOW_PAIR,
      );
      expect(freq.abandonment, tz).toBe(localDays(PAIR));
    });
  });

  // Контроль (правило №15): без него проверка выше могла бы совпасть с
  // прежним поведением во всех зонах и ничего не доказывать.
  it('контроль: гринвичский срез в какой-то зоне даёт другое число дней', () => {
    const grinwich = new Set(PAIR.map((iso) => iso.slice(0, 10))).size;
    const seen = new Set<number>();
    forEachTimeZone(() => seen.add(localDays(PAIR)));
    expect([...seen].some((n) => n !== grinwich)).toBe(true);
  });
});
