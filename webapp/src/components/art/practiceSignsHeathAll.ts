// Знаки «Для терапевта» по Хис и Стартап, гл. 1, 4: опросники — PathChecklist (пункты списка), темперамент —
// LifeLine (каким клиент был с детства), семь паттернов заботы — WarmSelf (тёплая забота о себе).
import type { GuideSign } from './guideSignsModel';
import { HEATH_PRACTICE_NOTE_SIGN as HEATH_BASE } from './practiceSignsHeath';

export const HEATH_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  ...HEATH_BASE,
  questionnaires: 'path_checklist',
  temperament: 'life_line',
  positive_patterns_in_session: 'warm_self',
};
