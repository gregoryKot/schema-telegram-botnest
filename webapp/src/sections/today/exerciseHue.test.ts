// Бумага силуэта упражнения — из ENTITY_LOOK, а не своим числом на месте (APP_2026-11.md, принцип 9).
import { describe, it, expect } from 'vitest';
import { exerciseHue } from './exerciseHue';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

describe('exerciseHue', () => {
  it('оттенок листа-героя упражнения', () => {
    expect(exerciseHue({ ex: 'belief' })).toBe(ENTITY_LOOK.belief_check.hue);
    expect(exerciseHue({ ex: 'letter' })).toBe(ENTITY_LOOK.letter.hue);
    expect(exerciseHue({ ex: 'flashcard' })).toBe(ENTITY_LOOK.sos.hue);
  });
  it('карточки схемы и режима — бумага своей семьи, с выбранным id и без', () => {
    expect(exerciseHue({ ex: 'schema' })).toBe(ENTITY_LOOK.schema_card.hue);
    expect(exerciseHue({ ex: 'mode', id: 'punitive_critic' })).toBe(ENTITY_LOOK.mode_card.hue);
  });
});
