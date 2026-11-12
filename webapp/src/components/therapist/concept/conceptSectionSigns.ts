import type { SignKey } from '../../../../../shared/src/theme/entityLook';
import type { ConceptTextField } from '../../../../../shared/src/therapy/clientSheetHelpers';
import type { BriefBlockId } from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';

// Знаки разделов концептуализации (docs/design/APP_2026-11.md, b33): раздел вида «Поля» и блок экрана
// «Главное» одной сущности несут один знак. Стили совладания — три знака копингов (один назвал бы все
// копинги капитуляцией), на бумаге неба 240.
export const SECTION_SIGNS: Record<ConceptTextField, readonly SignKey[]> = {
  goals: ['leaf'],
  earlyExperience: ['wheel'],
  unmetNeeds: ['strokes'],
  triggers: ['ribbon'],
  copingStyles: ['yield', 'shelter', 'shield'],
  modeTransitions: ['cluster'],
  currentProblems: ['pebbles'],
};

/** Блок «Главного»: бумага сущности и её знаки. Потребности — нейтральная бумага (hue нет): цвет несут чипы NeedArt. */
export const BRIEF_LOOK: Record<BriefBlockId, { hue?: number; signs: readonly SignKey[] }> = {
  schemas: { hue: 28, signs: ['layers'] },
  modes: { hue: 240, signs: ['cluster'] },
  needs: { signs: ['strokes'] },
  cycle: { hue: 310, signs: SECTION_SIGNS.modeTransitions },
  goals: { hue: 145, signs: SECTION_SIGNS.goals },
  problems: { hue: 70, signs: SECTION_SIGNS.currentProblems },
  triggers: { hue: 135, signs: SECTION_SIGNS.triggers },
  coping: { hue: 240, signs: SECTION_SIGNS.copingStyles },
  early: { hue: 45, signs: SECTION_SIGNS.earlyExperience },
};
