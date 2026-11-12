// Вид сущностей на карточках шаринга: оттенок бумаги и знак — строки ENTITY_LOOK
// (shared/src/theme/entityLook.ts) литералами. Карточки рисуются в ленивых чанках листов
// шаринга, а рантайм-импорт entityLook.ts перекраивает чанки (ловушка, docs/design/APP_2026-11.md):
// таблица здесь, сверка «совпадает с ENTITY_LOOK» — cardLook.test.ts (правило №4).
import type { SignKey } from '../../theme/signKeys';
export const CARD_LOOK = {
  tracker: { hue: 70, sign: 'strokes' },
  diary: { hue: 45, sign: 'pebbles' },
  gratitude: { hue: 195, sign: 'pebbles' },
  ysq: { hue: 28, sign: 'layers' },
  schemas: { hue: 28, sign: 'layers' },
  modes: { hue: 240, sign: 'cluster' },
  breathing: { hue: 195, sign: 'breath' },
  grounding: { hue: 135, sign: 'grounded' },
  stop: { hue: 70, sign: 'pause' },
  phrase_check: { hue: 310, sign: 'looming' },
  journey: { hue: 240, sign: 'sheets' },
} as const;

export type CardEntity = keyof typeof CARD_LOOK;

/** «Готово» трекера — лист шалфея с индексом и столбиками (ENTITY_LOOK, трекер: сцена «готово»). */
export const DAY_DONE_HUE = 135;

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

const ach = (hue: number, sign: SignKey, n?: number): AchievementLook =>
  n === undefined ? { hue, sign } : { hue, sign, n };

/**
 * Значки достижений — одна таблица на значок профиля (SVG) и canvas-карточки: оттенок и знак =
 * ACHIEVEMENT_LOOK (theme/entityLookMaps.ts), литералами — рантайм-импорт таблиц вида перекраивал
 * чанки (+20 КБ JS, CSS не в том порядке). Серия — полосок всё больше (7 — плотный ряд), дни
 * всего — листов больше (вариант мотива, countedSigns.ts). Сверка — cardLook.test.ts.
 */
export const ACHIEVEMENT_CARD_LOOK: Readonly<Record<string, AchievementLook>> = {
  first_day: ach(45, 'pebbles'),
  streak_3: ach(70, 'strokes', 2),
  streak_7: ach(70, 'strokes', 3),
  streak_14: ach(70, 'strokes', 4),
  streak_30: ach(70, 'strokes', 5),
  streak_100: ach(70, 'strokes', 7),
  total_10: ach(240, 'sheets', 2),
  total_50: ach(240, 'sheets', 4),
  high_day: ach(195, 'leaf'),
  all_above7: ach(45, 'wheel'),
  comeback: ach(70, 'child_care'),
  growth: ach(70, 'need_autonomy'),
  pair_connected: ach(28, 'need_attachment'),
};

/** Вид значка достижения; незнакомое — null (значок без выдуманного знака). */
export const achievementCardLook = (id: string | undefined): AchievementLook | null =>
  id && Object.hasOwn(ACHIEVEMENT_CARD_LOOK, id)
    ? ACHIEVEMENT_CARD_LOOK[id]
    : null;

/**
 * Приглашения (ENTITY_LOOK, «Кабинет терапевта»: приглашения — Talk, в пару — `pair`): в
 * приложение — персик 45 (бриф b23b) со знаком продукта и пятью полосками потребностей,
 * в пару — глина привязанности, от терапевта — небо встреч 240.
 */
export const INVITE_LOOK = {
  app: { hue: 45, sign: 'strokes' },
  pair: { hue: 28, sign: 'need_attachment' },
  therapist: { hue: 240, sign: 'talk' },
} as const satisfies Record<string, CardLook>;
export type InviteKind = keyof typeof INVITE_LOOK;
