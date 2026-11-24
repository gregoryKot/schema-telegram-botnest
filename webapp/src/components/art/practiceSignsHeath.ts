// Знаки разделов «Для терапевта» по Хис и Стартап (пачка 9 карты; сверка — guideSignsModel.test.tsx) и,
// чтобы guideSignsModel.ts не рос, Бехари. Трудное завершение — знак фазы «Завершение» пути терапии,
// схема-приёмы в краткой КПТ — «Протоколы» (метод внутри другого формата).
import { BEHARY_PRACTICE_NOTE_SIGN } from './practiceSignsBehary';
import type { GuideSign } from './guideSignsModel';

export const BEHARY_HEATH_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  ...BEHARY_PRACTICE_NOTE_SIGN,
  premature_ending: 'path_ending',
  cbt_with_schemas: 'path_protocols',
};
