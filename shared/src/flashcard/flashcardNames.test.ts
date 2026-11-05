// Имя и цифры карточки «Мне плохо» сверены с фактическим контентом (правило
// №4: два места, обязанные совпадать, держит тест-сверка).
import { describe, it, expect } from 'vitest';
import {
  FLASHCARD_SUB,
  FLASHCARD_TITLE,
  GROUNDING_BREATHS,
} from './flashcardNames';
import { STEPS } from './modes';
import {
  BREATH_HOLD_S,
  BREATH_IN_S,
  BREATH_OUT_S,
} from '../practices/breathing';
import { getQuickAction } from '../quickActions/quickActionsRegistry';
import { buildQuickPractice } from '../practices/quickPractices';

const WORD: Record<number, string> = { 3: 'три', 4: 'четыре', 5: 'пять' };

describe('карточка «Мне плохо»: одно имя, честные цифры', () => {
  it('подпись называет столько шагов, сколько их в карточке', () => {
    expect(FLASHCARD_SUB).toContain(`${WORD[STEPS.length]} шага`);
  });

  it('три вдоха первого экрана — в ритме практики дыхания', () => {
    expect(GROUNDING_BREATHS).toHaveLength(3);
    expect(GROUNDING_BREATHS[0]).toContain(`${BREATH_IN_S} секунд`);
    expect(GROUNDING_BREATHS[1]).toContain(`${BREATH_HOLD_S} секунд`);
    expect(GROUNDING_BREATHS[2]).toContain(`${BREATH_OUT_S} секунд`);
    const breathing = buildQuickPractice('breathing', (ty) => ty);
    expect(breathing.title).toBe(
      `Дыхание ${BREATH_IN_S}-${BREATH_HOLD_S}-${BREATH_OUT_S}`,
    );
  });

  it('пункт «Инструментов» зовётся так же, как кнопка топбара', () => {
    const def = getQuickAction('flashcard');
    expect(def.label).toBe(FLASHCARD_TITLE);
    expect(def.sub).toBe(FLASHCARD_SUB);
  });
});
