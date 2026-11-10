// Вид быстрых практик «Здесь и сейчас» (ENTITY_LOOK, shared/src/theme/entityLook.ts): бумага и знак
// дыхания, заземления и «Стопа» — лист практики в разделе, ⌘K, итоге разбора, паттерне; квадраты
// «Практик» берут их отсюда же (sections/practice/practiceLook.ts). Литералы, а не рантайм-импорт
// entityLook: он перекраивал чанки, и CSS-чанки в index.html вставали в другом порядке
// (check-css-link-order; тот же обход — paper/outcomeLook.ts, quickActionSign.ts). Сверка — quickLook.test.ts.
import type { Look } from '../../../../shared/src/theme/entityLook';
import type { QuickPracticeId } from '../../../../shared/src/practices/quickPractices';

export const QUICK_LOOK = {
  breathing: { hue: 195, sign: 'breath' },
  grounding: { hue: 135, sign: 'grounded' },
  stop: { hue: 70, sign: 'pause' },
} as const satisfies Record<QuickPracticeId, Look>;
