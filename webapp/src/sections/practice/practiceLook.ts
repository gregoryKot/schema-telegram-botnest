// Вид сущностей раздела «Практики» — строки ENTITY_LOOK (shared/src/theme/entityLook.ts): плитки библиотеки,
// герой дыхания и квадраты быстрых практик, строки «Каталогов» — бумага и знак сущности, а не выбор на месте.
import { ENTITY_LOOK, PAPER_HUE, type EntityId, type Look } from '../../../../shared/src/theme/entityLook';
import type { ExId } from './exerciseLibraryModel';

/** Шапка листа «Важное о самопомощи»: шалфей палитры и рамка метода Limits — своей сущности у листа нет. */
export const SELF_HELP_LOOK = { hue: PAPER_HUE.sage, sign: 'limits' } as const satisfies Look;

/** Упражнение → сущность: с пунктом «Инструментов» — сущность быстрого действия (QUICK_ACTION_ENTITY,
 *  как в ⌘K и листе настройки), карточки схемы и режима — сущности карточек (сверка — тест). */
export const EXERCISE_ENTITY: Record<ExId, EntityId> = {
  belief: 'belief_check', schema: 'schema_card', mode: 'mode_card', letter: 'letter',
  safe: 'safe_place', wheel: 'childhood_wheel', warm: 'warm_words', phrase: 'phrase_check',
};

export const exerciseLook = (id: ExId): Look => ENTITY_LOOK[EXERCISE_ENTITY[id]];
