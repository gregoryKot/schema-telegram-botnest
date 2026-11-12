// Вид сущностей на карточках шаринга: оттенок бумаги и знак — строки ENTITY_LOOK
// (shared/src/theme/entityLook.ts) литералами. Карточки рисуются в ленивых чанках листов
// шаринга, а рантайм-импорт entityLook.ts перекраивает чанки (ловушка, docs/design/APP_2026-11.md):
// таблица здесь, сверка «совпадает с ENTITY_LOOK» — cardLook.test.ts (правило №4).
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

const look = (hue: number, sign: string): CardLook => ({ hue, sign });

/**
 * Значки достижений — ACHIEVEMENT_LOOK значка в профиле (theme/entityLookMaps.ts) литералами:
 * рантайм-импорт таблиц вида в карточки (главный чанк) перекраивал чанки — +20 КБ JS и CSS
 * не в том порядке (check-css-link-order). Сверка «= ACHIEVEMENT_LOOK» — cardLook.test.ts.
 */
export const ACHIEVEMENT_CARD_LOOK: Readonly<Record<string, CardLook>> = {
  first_day: look(45, 'pebbles'),
  streak_3: look(70, 'strokes'),
  streak_7: look(70, 'strokes'),
  streak_14: look(70, 'strokes'),
  streak_30: look(70, 'strokes'),
  streak_100: look(70, 'strokes'),
  total_10: look(240, 'sheets'),
  total_50: look(240, 'sheets'),
  high_day: look(195, 'leaf'),
  all_above7: look(45, 'wheel'),
  comeback: look(70, 'child_care'),
  growth: look(70, 'need_autonomy'),
  pair_connected: look(28, 'need_attachment'),
};

/** Вид значка достижения; незнакомое — null (значок без выдуманного знака). */
export const achievementCardLook = (id: string | undefined): CardLook | null =>
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
