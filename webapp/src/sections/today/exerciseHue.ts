// Бумага силуэта упражнения (ExScreenSkeleton), пока грузится его чанк: тот же оттенок, что у
// листа-героя упражнения (ENTITY_LOOK), — картинка «уже на месте», а не серый лист, который потом
// перекрашивается. Карточки схемы и режима без выбора открываются листом своей семьи (глина, небо).
import { ENTITY_LOOK, type EntityId } from '../../../../shared/src/theme/entityLook';
import type { OpenExercise } from './useTaskLauncher';

const ENTITY_OF: Record<OpenExercise['ex'], EntityId> = {
  belief: 'belief_check',
  schema: 'schema_card',
  mode: 'mode_card',
  letter: 'letter',
  safe: 'safe_place',
  warm: 'warm_words',
  phrase: 'phrase_check',
  flashcard: 'sos',
  ysq: 'ysq',
};

export function exerciseHue(open: OpenExercise): number {
  return ENTITY_LOOK[ENTITY_OF[open.ex]].hue;
}

/** Открывается ли упражнение разворотом (ExScreen spread): письмо, место, проверка убеждения и карточка с уже
 *  выбранной схемой или режимом (вопросы, портрет). Силуэт той же формы — лист-герой слева на ≥1024, а не
 *  полоса во всю колонку, которая прыгает в лист, когда приходит чанк (ревью g6, правило скелетонов). */
export function exerciseSpread(open: OpenExercise): boolean {
  if (open.ex === 'schema' || open.ex === 'mode') return Boolean(open.id);
  return open.ex === 'belief' || open.ex === 'letter' || open.ex === 'safe';
}
