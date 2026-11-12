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
