// Регрессия (инцидент 2026-07): активность схем считалась только «классикой»
// (>50% ответов 5–6). Пользователь, отметивший все утверждения на «4»,
// получал 0% по каждой схеме и пустой список выраженных схем в профиле —
// «схемы, которые у меня были, не добавились». Теперь схема активна и по
// среднему баллу (avg >= 4 из 6).
import { computeActiveSchemas, computeYsqScores } from './ysq';

const N_QUESTIONS = 116;
const N_SCHEMAS = 20;

function allAnswers(value: number): number[] {
  return Array<number>(N_QUESTIONS).fill(value);
}

describe('computeYsqScores', () => {
  it('считает обе метрики: классику (pct5plus) и средний балл (avg)', () => {
    const scores = computeYsqScores(allAnswers(4));
    expect(scores).toHaveLength(N_SCHEMAS);
    for (const s of scores) {
      expect(s.pct5plus).toBe(0);
      expect(s.avg).toBe(4);
    }
  });

  it('неотвеченные вопросы (0) не входят в сумму, но остаются в знаменателе', () => {
    const answers = allAnswers(0);
    // первая схема (emotional_deprivation) — вопросы 1–5: три шестёрки из пяти
    answers[0] = 6;
    answers[1] = 6;
    answers[2] = 6;
    const s = computeYsqScores(answers).find(
      (x) => x.id === 'emotional_deprivation',
    )!;
    expect(s.pct5plus).toBe(60);
    expect(s.avg).toBe(3.6); // 18 / 5
  });
});

describe('computeActiveSchemas', () => {
  it('все ответы «4» → все схемы активны по среднему баллу (инцидент)', () => {
    expect(computeActiveSchemas(allAnswers(4))).toHaveLength(N_SCHEMAS);
  });

  it('все ответы «3» → активных схем нет', () => {
    expect(computeActiveSchemas(allAnswers(3))).toHaveLength(0);
  });

  it('классический критерий по-прежнему работает: >50% ответов 5–6', () => {
    const answers = allAnswers(1);
    // abandonment — вопросы 6–13 (8 шт.): пять пятёрок из восьми = 63%
    for (const q of [6, 7, 8, 9, 10]) answers[q - 1] = 5;
    // avg = (5*5 + 3*1) / 8 = 3.5 < 4 — активируется именно классикой
    expect(computeActiveSchemas(answers)).toEqual(['abandonment']);
  });
});
