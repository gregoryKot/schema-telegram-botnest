// Вид раздела «Практики» (practiceLook.ts): у каждого упражнения своя пара «бумага + знак» из ENTITY_LOOK,
// сущность упражнения с пунктом «Инструментов» — та же, что у быстрого действия; порядок по умолчанию (без
// перестановки в «Инструментах») — порядок библиотеки, в котором соседние плитки бенто на 2 и 3 колонки
// разной бумаги (сверка оттенков — entityLook.test.ts).
import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK, QUICK_ACTION_ENTITY } from '../../../../shared/src/theme/entityLook';
import { EXERCISES } from './exerciseLibraryModel';
import { EXERCISE_ENTITY, exerciseLook } from './practiceLook';
import { arrangeExercises, CARD_TOOL_IDS, EXERCISE_TOOL } from './toolsLayout';

describe('practiceLook', () => {
  it('вид упражнения — строка ENTITY_LOOK его сущности', () => {
    for (const e of EXERCISES) expect(exerciseLook(e.id), e.id).toBe(ENTITY_LOOK[EXERCISE_ENTITY[e.id]]);
  });

  it('у каждого упражнения свой вид: пара «оттенок + знак» не повторяется', () => {
    const pairs = EXERCISES.map((e) => `${exerciseLook(e.id).hue}/${exerciseLook(e.id).sign}`);
    expect(new Set(pairs).size).toBe(EXERCISES.length);
  });

  it('упражнение с пунктом «Инструментов» — сущность его быстрого действия; схема и режим — карточки', () => {
    for (const e of EXERCISES) {
      const tool = EXERCISE_TOOL[e.id];
      if (tool) expect(EXERCISE_ENTITY[e.id], e.id).toBe(QUICK_ACTION_ENTITY[tool]);
    }
    expect(EXERCISE_ENTITY.schema).toBe('schema_card');
    expect(EXERCISE_ENTITY.mode).toBe('mode_card');
  });

  it('порядок по умолчанию на странице — порядок библиотеки', () => {
    const shown = arrangeExercises(EXERCISES, CARD_TOOL_IDS, []).map((e) => e.id);
    expect(shown).toEqual(EXERCISES.map((e) => e.id));
  });
});
