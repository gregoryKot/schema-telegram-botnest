// Вид сущностей раздела «Практики» (ENTITY_LOOK, shared/src/theme/entityLook.ts) — плитки библиотеки,
// герой дыхания и квадраты быстрых практик (общие с листом практики — QUICK_LOOK), строки «Каталогов»:
// бумага и знак сущности, а не выбор на месте.
// Литералы, а не рантайм-импорт entityLook: он перекраивал чанки — CSS упражнений вставал раньше
// index.css (check-css-link-order; тот же обход — paper/outcomeLook.ts, quickActionSign.ts).
// Сверка с таблицей — practiceLook.test.ts.
import type { EntityId, Look } from '../../../../shared/src/theme/entityLook';
import type { ExId } from './exerciseLibraryModel';
import { QUICK_LOOK } from '../../components/practice/quickLook';

export const PRACTICE_LOOK = {
  belief_check: { hue: 70, sign: 'scales' },
  schema_card: { hue: 28, sign: 'layers' },
  mode_card: { hue: 240, sign: 'cluster' },
  letter: { hue: 290, sign: 'sheets' },
  safe_place: { hue: 135, sign: 'haven' },
  childhood_wheel: { hue: 45, sign: 'wheel' },
  warm_words: { hue: 70, sign: 'heart' },
  phrase_check: { hue: 310, sign: 'looming' },
  breathing: QUICK_LOOK.breathing,
  grounding: QUICK_LOOK.grounding,
  stop: QUICK_LOOK.stop,
  sos: { hue: 25, sign: 'heart' },
  nourish: { hue: 145, sign: 'leaf' },
  plan: { hue: 135, sign: 'check' },
  modes: { hue: 240, sign: 'cluster' },
} as const satisfies Partial<Record<EntityId, Look>>;
export type PracticeEntity = keyof typeof PRACTICE_LOOK;

/** Упражнение → сущность: с пунктом «Инструментов» — сущность быстрого действия (QUICK_ACTION_ENTITY,
 *  как в ⌘K и листе настройки), карточки схемы и режима — сущности карточек (сверка — тест). */
export const EXERCISE_ENTITY: Record<ExId, PracticeEntity> = {
  belief: 'belief_check', schema: 'schema_card', mode: 'mode_card', letter: 'letter',
  safe: 'safe_place', wheel: 'childhood_wheel', warm: 'warm_words', phrase: 'phrase_check',
};

export const exerciseLook = (id: ExId): Look => PRACTICE_LOOK[EXERCISE_ENTITY[id]];
