// Раскладка «Инструментов» по карточкам библиотеки «Практики»: порядок и
// скрытие пунктов реестра действуют на карточки с пунктом; «Карточка схемы» и
// «Карточка режима» (в реестре их нет) стоят на своих местах и не скрываются.
import { describe, it, expect } from 'vitest';
import { EXERCISES } from './exerciseLibrary';
import { CARD_TOOL_IDS, EXERCISE_TOOL, arrangeExercises } from './toolsLayout';
import { buildToolRows } from '../../../../shared/src/quickActions/toolRows';

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);
const REGISTRY_ORDER = buildToolRows({ tasksCount: 0, childhoodDone: false }).map((r) => r.id);

describe('arrangeExercises', () => {
  it('без настроек порядок библиотеки не меняется, номера по порядку', () => {
    const out = arrangeExercises(EXERCISES, CARD_TOOL_IDS, []);
    expect(ids(out)).toEqual(ids(EXERCISES));
    expect(out.map((c) => c.num)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08']);
  });

  it('карточки с пунктом занимают свои места в порядке пользователя, схема и режим — на месте', () => {
    const out = arrangeExercises(EXERCISES, ['warm_words', 'phrase_check', 'belief_check', 'safe_place', 'letter_to_self', 'childhood_wheel'], []);
    expect(ids(out)).toEqual(['warm', 'schema', 'mode', 'phrase', 'belief', 'safe', 'letter', 'wheel']);
  });

  it('порядок по умолчанию — как в мини-аппе («Критик или забота?» первым), общий ключ порядка', () => {
    const out = arrangeExercises(EXERCISES, REGISTRY_ORDER, []);
    expect(ids(out)).toEqual(['phrase', 'schema', 'mode', 'belief', 'safe', 'letter', 'wheel', 'warm']);
  });

  it('скрытый пункт убирает карточку и пересчитывает номера', () => {
    const out = arrangeExercises(EXERCISES, REGISTRY_ORDER, ['safe_place']);
    expect(ids(out)).not.toContain('safe');
    expect(out.map((c) => c.num)).toEqual(['01', '02', '03', '04', '05', '06', '07']);
  });

  it('все пункты реестра скрыты — остаются только схема и режим', () => {
    const out = arrangeExercises(EXERCISES, REGISTRY_ORDER, [...CARD_TOOL_IDS]);
    expect(ids(out)).toEqual(['schema', 'mode']);
  });

  it('пункт без карточки (tasks, flashcard…) на библиотеку не влияет', () => {
    expect(ids(arrangeExercises(EXERCISES, CARD_TOOL_IDS, ['tasks', 'flashcard', 'plans']))).toEqual(ids(EXERCISES));
  });

  it('пункта нет в сохранённом порядке — карточка уходит после известных, но не теряется', () => {
    const out = arrangeExercises(EXERCISES, ['warm_words'], []);
    expect(out).toHaveLength(8);
    expect(ids(out)[0]).toBe('warm');
  });
});

describe('EXERCISE_TOOL ↔ реестр', () => {
  it('каждый пункт, привязанный к карточке, есть среди десяти пунктов «Инструментов»', () => {
    for (const tool of CARD_TOOL_IDS) expect(REGISTRY_ORDER).toContain(tool);
  });

  it('привязаны ровно карточки упражнений, которые есть в библиотеке', () => {
    const exIds = EXERCISES.map((e) => e.id);
    for (const ex of Object.keys(EXERCISE_TOOL)) expect(exIds).toContain(ex);
  });
});
