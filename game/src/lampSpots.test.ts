import { describe, it, expect } from 'vitest';
import { lampSpots } from './lampSpots';

describe('lampSpots', () => {
  it('ставит фонари с шагом 540 и не доходит до конца арены', () => {
    expect(lampSpots(1700, [])).toEqual([330, 870, 1410]);
  });

  it('фонарь над ямой или у её края переезжает за яму', () => {
    expect(lampSpots(1700, [{ s: 760, e: 900 }, { s: 1440, e: 1520 }])).toEqual([330, 964, 1584]);
  });

  it('ни один фонарь не стоит над ямой', () => {
    const pits = [{ s: 760, e: 900 }, { s: 1300, e: 1520 }, { s: 2950, e: 3210 }];
    for (const x of lampSpots(4700, pits)) expect(pits.some(p => x >= p.s && x <= p.e)).toBe(false);
  });
});
