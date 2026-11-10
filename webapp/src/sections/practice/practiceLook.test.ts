// Вид раздела «Практики» литералами (practiceLook.ts) совпадает с таблицей ENTITY_LOOK; у каждого
// упражнения своя пара «бумага + знак», сущность упражнения с пунктом «Инструментов» — та же, что у
// быстрого действия; порядок по умолчанию (без перестановки в «Инструментах») — порядок библиотеки, в
// котором соседние плитки бенто на 2 и 3 колонки разной бумаги (сверка оттенков — entityLook.test.ts).
import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK, PAPER_HUE, QUICK_ACTION_ENTITY } from '../../../../shared/src/theme/entityLook';
import { EXERCISES } from './exerciseLibraryModel';
import { EXERCISE_ENTITY, PRACTICE_LOOK, SELF_HELP_LOOK, exerciseLook, type PracticeEntity } from './practiceLook';
import { arrangeExercises, CARD_TOOL_IDS, EXERCISE_TOOL } from './toolsLayout';

describe('practiceLook', () => {
  it.each(Object.keys(PRACTICE_LOOK) as PracticeEntity[])('%s — бумага и знак из ENTITY_LOOK', (id) => {
    const { hue, sign } = ENTITY_LOOK[id];
    expect(PRACTICE_LOOK[id]).toEqual({ hue, sign });
  });

  it('шапка «Важного о самопомощи» — шалфей палитры и рамка метода', () => {
    expect(SELF_HELP_LOOK).toEqual({ hue: PAPER_HUE.sage, sign: 'limits' });
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
