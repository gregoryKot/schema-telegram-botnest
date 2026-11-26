// Тексты лендинга через glue (shared/src/utils/typo.ts): слова те же, что у HTML для робота, тире не
// начинает строку, «Всё по схеме» держится целиком.
import { describe, it, expect } from 'vitest';
import { glue } from '../../../../shared/src/utils/typo';
import { HOME_HERO, HOME_FINAL, HOME_HEADINGS } from '../../../../src/articles/home-landing.content';

const NB = '\u00a0';
const plain = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\u2011/g, '-');

describe('glue: тексты лендинга', () => {
  it('слова те же, тире не начинает строку', () => {
    for (const s of [HOME_HERO.lead, HOME_FINAL.title, HOME_FINAL.text, ...Object.values(HOME_HEADINGS)]) {
      const g = glue(s);
      expect(plain(g)).toBe(plain(s));
      expect(g).not.toMatch(/ —/);
    }
    expect(glue(HOME_HERO.lead)).toContain(`«Всё${NB}по${NB}схеме»${NB}—`);
  });
});
