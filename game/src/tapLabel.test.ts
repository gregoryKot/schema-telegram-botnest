import { describe, expect, it } from 'vitest';
import { M } from './i18n/messages';
import { isLongTapLabel } from './tapLabel';

describe('isLongTapLabel — какой подписи тач-кнопки нужен кегль 8px', () => {
  it('SURRENDER (9 знаков: 90px в 10px при 76px внутри рамки) — длинная', () => {
    expect(isLongTapLabel(M.m_surrender.en)).toBe(true);
  });

  it('УСТУПИ, ИЗБЕГАЙ (7 знаков — край), БЕЙ, AVOID, FIGHT влезают в 10px', () => {
    for (const label of [M.m_surrender.ru, M.m_avoid.ru, M.m_fight.ru, M.m_avoid.en, M.m_fight.en]) {
      expect(isLongTapLabel(label)).toBe(false);
    }
  });
});
