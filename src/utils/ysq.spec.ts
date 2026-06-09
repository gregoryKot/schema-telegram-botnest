import { computeYsqScores, computeActiveSchemas } from './ysq';

// answers индексируются вопрос-1; максимальный вопрос = 116
function answers(set: Record<number, number> = {}): number[] {
  const a = new Array(116).fill(0);
  for (const [q, v] of Object.entries(set)) a[Number(q) - 1] = v;
  return a;
}

describe('computeYsqScores', () => {
  it('возвращает запись по каждой из 20 схем', () => {
    expect(computeYsqScores(answers())).toHaveLength(20);
  });

  it('все ответы 0 → pct5plus = 0 везде', () => {
    expect(computeYsqScores(answers()).every((s) => s.pct5plus === 0)).toBe(true);
  });

  it('emotional_deprivation: все 5 вопросов ≥5 → 100%', () => {
    const a = answers({ 1: 5, 2: 6, 3: 5, 4: 5, 5: 5 });
    expect(computeYsqScores(a).find((s) => s.id === 'emotional_deprivation')!.pct5plus).toBe(100);
  });

  it('3 из 5 вопросов ≥5 → 60%', () => {
    const a = answers({ 1: 5, 2: 5, 3: 5 }); // 4,5 = 0
    expect(computeYsqScores(a).find((s) => s.id === 'emotional_deprivation')!.pct5plus).toBe(60);
  });

  it('порог ≥5: значение 4 не считается, 5 считается', () => {
    const a = answers({ 1: 4, 2: 4, 3: 4, 4: 4, 5: 5 }); // только 1 из 5
    expect(computeYsqScores(a).find((s) => s.id === 'emotional_deprivation')!.pct5plus).toBe(20);
  });

  it('отсутствующие ответы трактуются как 0', () => {
    const short = [5, 5]; // только 2 ответа; вопросы 3..5 → undefined → 0
    expect(computeYsqScores(short).find((s) => s.id === 'emotional_deprivation')!.pct5plus).toBe(40);
  });
});

describe('computeActiveSchemas', () => {
  it('все нули → пустой список', () => {
    expect(computeActiveSchemas(answers())).toEqual([]);
  });

  it('включает схему с pct5plus > 50', () => {
    const a = answers({ 1: 5, 2: 5, 3: 5 }); // ed = 60%
    expect(computeActiveSchemas(a)).toContain('emotional_deprivation');
  });

  it('ровно 50% НЕ активна (строгое >50)', () => {
    // abandonment: 8 вопросов [6..13], 4 из 8 = 50%
    const a = answers({ 6: 5, 7: 5, 8: 5, 9: 5 });
    expect(computeActiveSchemas(a)).not.toContain('abandonment');
  });

  it('62.5% (5 из 8) → активна', () => {
    const a = answers({ 6: 5, 7: 5, 8: 5, 9: 5, 10: 5 });
    expect(computeActiveSchemas(a)).toContain('abandonment');
  });
});
