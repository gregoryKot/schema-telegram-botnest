// Вид сущностей на карточках шаринга: оттенок бумаги и знак — строки ENTITY_LOOK, значки достижений —
// ACHIEVEMENT_LOOK (shared/src/theme/entityLook.ts) с числом фигур мотива.
import {
  ENTITY_LOOK,
  OUTCOME_LOOK,
  achievementLook,
  type SignKey,
} from '../../theme/entityLook';

export const CARD_LOOK = {
  tracker: ENTITY_LOOK.tracker,
  diary: ENTITY_LOOK.diary,
  gratitude: ENTITY_LOOK.gratitude,
  ysq: ENTITY_LOOK.ysq,
  schemas: ENTITY_LOOK.schemas,
  modes: ENTITY_LOOK.modes,
  breathing: ENTITY_LOOK.breathing,
  grounding: ENTITY_LOOK.grounding,
  stop: ENTITY_LOOK.stop,
  phrase_check: ENTITY_LOOK.phrase_check,
  journey: ENTITY_LOOK.journey,
};

export type CardEntity = keyof typeof CARD_LOOK;

/** «Готово» трекера — лист шалфея с индексом и столбиками (исход «готово», OUTCOME_LOOK). */
export const DAY_DONE_HUE = OUTCOME_LOOK.done.hue;

export interface CardLook {
  hue: number;
  sign: string;
}

/** Вид значка достижения: оттенок, знак и число фигур мотива (`n`: полоски серии, листы «дней всего»). */
export interface AchievementLook {
  hue: number;
  sign: SignKey;
  n?: number;
}

/** Число фигур мотива: серия — полосок всё больше (7 — плотный ряд), дни всего — листов больше
 *  (вариант мотива, countedSigns.ts). */
const ACHIEVEMENT_N: Readonly<Record<string, number>> = {
  streak_3: 2,
  streak_7: 3,
  streak_14: 4,
  streak_30: 5,
  streak_100: 7,
  total_10: 2,
  total_50: 4,
};

/**
 * Значок достижения — один вид на значок профиля (SVG) и canvas-карточки: оттенок и знак —
 * ACHIEVEMENT_LOOK, число фигур — ACHIEVEMENT_N; незнакомое — null (значок без выдуманного знака).
 */
export function achievementCardLook(
  id: string | undefined,
): AchievementLook | null {
  const look = id ? achievementLook(id) : null;
  if (!id || !look) return null;
  const n = Object.hasOwn(ACHIEVEMENT_N, id) ? ACHIEVEMENT_N[id] : undefined;
  return n === undefined
    ? { hue: look.hue, sign: look.sign }
    : { hue: look.hue, sign: look.sign, n };
}

/**
 * Приглашения (ENTITY_LOOK, «Кабинет терапевта»: приглашения — Talk, в пару — `pair`): в
 * приложение — персик 45 (бриф b23b) со знаком продукта и пятью полосками потребностей,
 * в пару — глина привязанности, от терапевта — небо встреч 240.
 */
export const INVITE_LOOK = {
  app: { hue: 45, sign: 'strokes' },
  pair: ENTITY_LOOK.pair,
  therapist: ENTITY_LOOK.therapist,
} as const satisfies Record<string, CardLook>;
export type InviteKind = keyof typeof INVITE_LOOK;
