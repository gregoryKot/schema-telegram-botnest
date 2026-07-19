// ysq.ts — клинический скоринг опросника Янга (YSQ): вычисляет % ответов
// ≥5 по каждой из 20 схем и какие схемы «активны» (>50%). Это единственное
// место, где вопрос сопоставляется со схемой — ошибка в диапазоне вопросов
// молча портит клиническую интерпретацию. Фикстуры ниже посчитаны прогоном
// самого алгоритма (answers[q-1], Math.round((count/total)*100)) на
// сконструированных входах — не переформулировка формулы, а проверка её
// применения к конкретным индексам вопросов, взятым из YSQ_SCHEMAS.
import { computeActiveSchemas, computeYsqScores, YsqSchemaScore } from './ysq';

const TOTAL_QUESTIONS = 116; // punitiveness_others заканчивается на вопросе 116

/** answers[0] = ответ на вопрос №1. По умолчанию — 1 (никогда не считается ≥5). */
function buildAnswers(overrides: Record<number, number> = {}): number[] {
  const arr = new Array(TOTAL_QUESTIONS).fill(1);
  for (const [q, v] of Object.entries(overrides)) {
    arr[Number(q) - 1] = v;
  }
  return arr;
}

function scoreOf(scores: YsqSchemaScore[], id: string): number {
  const s = scores.find((s) => s.id === id);
  if (!s) throw new Error(`schema ${id} not found in scores`);
  return s.pct5plus;
}

describe('computeYsqScores', () => {
  it('пустой массив ответов — все 20 схем на 0%, ни одна не пропущена', () => {
    const scores = computeYsqScores([]);
    expect(scores).toHaveLength(20);
    expect(scores.every((s) => s.pct5plus === 0)).toBe(true);
  });

  it('все ответы максимальные (6) — все схемы 100%', () => {
    const scores = computeYsqScores(new Array(TOTAL_QUESTIONS).fill(6));
    expect(scores.every((s) => s.pct5plus === 100)).toBe(true);
  });

  it('вопрос 1-индексирован: ответ ставится в answers[q-1], а не answers[q]', () => {
    // emotional_deprivation = вопросы [1..5] → индексы массива [0..4].
    // Если бы код использовал answers[q] вместо answers[q-1], этот ответ
    // (поставленный на позицию вопроса №1, т.е. индекс 0) не попал бы в схему.
    const answers = buildAnswers({ 1: 6, 2: 6, 3: 6, 4: 6, 5: 6 });
    expect(scoreOf(computeYsqScores(answers), 'emotional_deprivation')).toBe(
      100,
    );
  });

  it('граница округления: 3/5 (60%) — mistrust активна', () => {
    // mistrust = [14,15,16,17,18], 5 вопросов
    const answers = buildAnswers({ 14: 6, 15: 6, 16: 6, 17: 1, 18: 1 });
    expect(scoreOf(computeYsqScores(answers), 'mistrust')).toBe(60);
  });

  it('граница округления: ровно 50% (4/8, abandonment) — НЕ активна (порог строго >50)', () => {
    // abandonment = [6,7,8,9,10,11,12,13], 8 вопросов
    const answers = buildAnswers({
      6: 6,
      7: 6,
      8: 6,
      9: 6,
      10: 1,
      11: 1,
      12: 1,
      13: 1,
    });
    const scores = computeYsqScores(answers);
    expect(scoreOf(scores, 'abandonment')).toBe(50);
    expect(computeActiveSchemas(answers)).not.toContain('abandonment');
  });

  it('округление Math.round для не кратных 100 долей: 3/7 → 43%, 4/7 → 57%', () => {
    // enmeshment = [50..56], 7 вопросов
    const under = buildAnswers({
      50: 6,
      51: 6,
      52: 6,
      53: 1,
      54: 1,
      55: 1,
      56: 1,
    });
    expect(scoreOf(computeYsqScores(under), 'enmeshment')).toBe(43);

    const over = buildAnswers({
      50: 6,
      51: 6,
      52: 6,
      53: 6,
      54: 1,
      55: 1,
      56: 1,
    });
    expect(scoreOf(computeYsqScores(over), 'enmeshment')).toBe(57);
  });

  it('значение ровно 5 засчитывается как «≥5» (граница v >= 5, не > 5)', () => {
    const answers = buildAnswers({ 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 });
    expect(scoreOf(computeYsqScores(answers), 'emotional_deprivation')).toBe(
      100,
    );
  });

  it('значение 4 не засчитывается — ниже порога ≥5', () => {
    const answers = buildAnswers({ 1: 4, 2: 4, 3: 4, 4: 4, 5: 4 });
    expect(scoreOf(computeYsqScores(answers), 'emotional_deprivation')).toBe(0);
  });

  it('отсутствующие «хвостовые» ответы (короче TOTAL_QUESTIONS) трактуются как 0 (не ≥5)', () => {
    // punitiveness_others = [113,114,115,116] — обрезаем массив до 100 ответов,
    // вопросы 113-116 отсутствуют вовсе (answers[q-1] === undefined → ?? 0).
    const answers = new Array(100).fill(6);
    const scores = computeYsqScores(answers);
    expect(scoreOf(scores, 'punitiveness_others')).toBe(0);
  });

  it('последняя схема (punitiveness_others, вопросы 113-116) корректно скорится на полном массиве', () => {
    const answers = buildAnswers({ 113: 6, 114: 6, 115: 1, 116: 1 });
    expect(scoreOf(computeYsqScores(answers), 'punitiveness_others')).toBe(50);
  });

  it('возвращает ровно 20 схем в фиксированном порядке (id из YSQ_SCHEMAS)', () => {
    const ids = computeYsqScores([]).map((s) => s.id);
    expect(ids).toEqual([
      'emotional_deprivation',
      'abandonment',
      'mistrust',
      'social_isolation',
      'defectiveness',
      'failure',
      'dependence',
      'vulnerability',
      'enmeshment',
      'subjugation',
      'self_sacrifice',
      'emotion_inhibition_fear',
      'emotional_inhibition',
      'unrelenting_standards',
      'entitlement',
      'insufficient_self_control',
      'approval_seeking',
      'negativity',
      'punitiveness_self',
      'punitiveness_others',
    ]);
  });
});

describe('computeActiveSchemas', () => {
  it('пустые ответы — активных схем нет', () => {
    expect(computeActiveSchemas([])).toEqual([]);
  });

  it('смешанный вход: активны только схемы строго выше 50%', () => {
    const answers = buildAnswers({
      // emotional_deprivation: 5/5 = 100% — активна
      1: 6,
      2: 6,
      3: 6,
      4: 6,
      5: 6,
      // abandonment: 4/8 = 50% — граница, НЕ активна
      6: 6,
      7: 6,
      8: 6,
      9: 6,
      // mistrust: 3/5 = 60% — активна
      14: 6,
      15: 6,
      16: 6,
    });
    expect(computeActiveSchemas(answers)).toEqual([
      'emotional_deprivation',
      'mistrust',
    ]);
  });

  it('все ответы максимальные — активны все 20 схем', () => {
    const answers = new Array(TOTAL_QUESTIONS).fill(6);
    expect(computeActiveSchemas(answers)).toHaveLength(20);
  });
});
