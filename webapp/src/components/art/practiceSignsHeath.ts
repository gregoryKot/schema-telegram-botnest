// Знаки «Для терапевта» по Хис и Стартап: тело терапевта — пузырь безопасности; трудное завершение — фаза «Завершение»; КПТ со схема-приёмами — «Протоколы».
import type { GuideSign } from './guideSignsModel';
export const HEATH_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  body_cues_therapist: 'bubble',
  premature_ending: 'path_ending',
  cbt_with_schemas: 'path_protocols',
};
