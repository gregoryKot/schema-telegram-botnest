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
});
