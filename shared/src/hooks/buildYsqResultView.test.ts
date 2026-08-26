// Сборка результата YSQ — чистая функция, вынесенная из useYsqTest (правило
// №10). Проверяем то, ради чего она существует: порядок схем, разбивку по
// доменам, подпись даты, склонение счётчика и дельту к прошлому прохождению.
import { describe, it, expect } from 'vitest';
import { buildYsqResultView } from './buildYsqResultView';
import { computeScores } from './ysqScoring';
import { SCHEMAS, SCHEMA_NAME_TO_ID } from './ysqSchemas';
import { QUESTIONS } from './ysqQuestions';

/**
 * Ответы, где все вопросы названных схем — 6, остальные — 1.
 * Номера вопросов у схемы 1-based (см. computeScores).
 */
function answersFor(schemaNames: string[]): number[] {
  const hot = new Set(
    SCHEMAS.filter((s) => schemaNames.includes(s.name)).flatMap(
      (s) => s.questions,
    ),
  );
  return QUESTIONS.map((_, i) => (hot.has(i + 1) ? 6 : 1));
}

describe('buildYsqResultView', () => {
  it('без результатов теста возвращает null', () => {
    expect(buildYsqResultView(null, [], null)).toBeNull();
  });

  it('на чистых ответах активных схем нет, подпись говорит об этом', () => {
    const view = buildYsqResultView(computeScores(answersFor([])), [], null);
    expect(view?.activeSchemas).toEqual([]);
    expect(view?.activeCount).toBe(0);
    expect(view?.activeLabel).toBe('Активных схем не найдено');
    expect(view?.activeByDomain).toEqual([]);
    // Все схемы попадают в «неактивные» — ни одна не теряется.
    expect(view?.inactiveSchemas).toHaveLength(SCHEMAS.length);
  });

  it('выраженная схема попадает в активные и в свой домен', () => {
    const target = SCHEMAS[0].name;
    const view = buildYsqResultView(
      computeScores(answersFor([target])),
      [],
      null,
    );
    expect(view?.activeSchemas.map((s) => s.name)).toContain(target);
    // Самая выраженная — первой в сортировке.
    expect(view?.activeSchemas[0].name).toBe(target);
    const domain = view?.activeByDomain.find((d) =>
      d.schemas.some((s) => s.name === target),
    );
    expect(domain?.needId).toBe(SCHEMAS[0].needId);
    // Пустых доменов в разбивке не остаётся.
    expect(view?.activeByDomain.every((d) => d.schemas.length > 0)).toBe(true);
  });

  it('счётчик активных склоняется: 1 / 2-4 / 5+', () => {
    const label = (n: number) =>
      buildYsqResultView(
        computeScores(answersFor(SCHEMAS.slice(0, n).map((s) => s.name))),
        [],
        null,
      )?.activeLabel;
    expect(label(1)).toContain('выраженная схема');
    expect(label(2)).toContain('выраженные схемы');
    expect(label(5)).toContain('выраженных схем');
  });

  it('дата прохождения показывается по-русски, без даты — null', () => {
    const scores = computeScores(answersFor([]));
    expect(
      buildYsqResultView(scores, [], '2026-03-14T10:00:00Z')?.dateLabel,
    ).toBe('14 марта 2026 г.');
    expect(buildYsqResultView(scores, [], null)?.dateLabel).toBeNull();
  });

  it('дельта считается ко ВТОРОЙ записи истории (прошлое прохождение)', () => {
    const target = SCHEMAS[0].name;
    const id = SCHEMA_NAME_TO_ID[target];
    const scores = computeScores(answersFor([target]));
    const history = [
      // [0] — текущее прохождение, сравнивать надо не с ним.
      { id: 2, completedAt: 'now', scores: [{ id, pct5plus: 100, avg: 6 }] },
      { id: 1, completedAt: 'then', scores: [{ id, pct5plus: 50, avg: 4 }] },
    ];
    const view = buildYsqResultView(scores, history, null);
    expect(view?.getSchemaDelta(target)).toBe(2);
  });

  it('без прошлого прохождения (или без avg в нём) дельты нет', () => {
    const target = SCHEMAS[0].name;
    const id = SCHEMA_NAME_TO_ID[target];
    const scores = computeScores(answersFor([target]));
    expect(
      buildYsqResultView(scores, [], null)?.getSchemaDelta(target),
    ).toBeNull();
    const noAvg = [
      { id: 2, completedAt: 'now', scores: [{ id, pct5plus: 100 }] },
      { id: 1, completedAt: 'then', scores: [{ id, pct5plus: 50 }] },
    ];
    expect(
      buildYsqResultView(scores, noAvg, null)?.getSchemaDelta(target),
    ).toBeNull();
  });
});
