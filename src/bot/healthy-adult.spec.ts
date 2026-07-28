import { HEALTHY_ADULT_PHRASES } from './healthy-adult.data';

describe('healthy-adult fallback pool', () => {
  it('большой пул без пустых и дублирующихся строк', () => {
    expect(HEALTHY_ADULT_PHRASES.length).toBeGreaterThanOrEqual(30);
    expect(HEALTHY_ADULT_PHRASES.every((p) => p.trim().length > 0)).toBe(true);
    expect(new Set(HEALTHY_ADULT_PHRASES).size).toBe(
      HEALTHY_ADULT_PHRASES.length,
    );
  });

  it('без AI-штампов и токсичного позитива (запреты брифа)', () => {
    const banned = [
      'важно помнить',
      'стоит отметить',
      'в конечном итоге',
      'помни, что',
      'всё к лучшему',
      'мысли позитивно',
      'возьми себя в руки',
      'хватит ныть',
    ];
    const offenders = HEALTHY_ADULT_PHRASES.filter((p) =>
      banned.some((b) => p.toLowerCase().includes(b)),
    );
    expect(offenders).toEqual([]);
  });

  // Свип 2026-07 (docs/VOICE.md): 18 фраз из 46 были построены на одном
  // скелете «Это не X. Это Y» — подряд пул читался как одна заготовка.
  // Переназывание остаётся законной формой брифа, но только пока оно редкое
  // и вторая часть даёт новое («Это не каприз, это счётчик»).
  it('определение через отрицание не расползается по пулу', () => {
    const skeleton = [
      /[Ээ]то\s+не\s+[^.!?]{2,60}[,.]\s*[Ээ]то\s/, // «это не X, это Y»
      /[Ээ]то\s+не\s+про\s/, // «это не про X, это про Y»
      /[—–]\s*это\s+не\s/, // «X — это не Y, а Z»
    ];
    const offenders = HEALTHY_ADULT_PHRASES.filter((p) =>
      skeleton.some((re) => re.test(p)),
    );
    expect(offenders.length).toBeLessThanOrEqual(2);
  });
});
