// Знаки «Для терапевта» по Хис и Стартап: тело терапевта — пузырь безопасности; трудное завершение — фаза «Завершение»; КПТ со схема-приёмами — «Протоколы»; возврат к своему Здоровому Взрослому — «Управление режимами»; культура и схемы терапевта — «Ценности».
import type { GuideSign } from './guideSignsModel';
export const HEATH_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  body_cues_therapist: 'bubble',
  premature_ending: 'path_ending', cbt_with_schemas: 'path_protocols',
  therapist_mode_reset: 'path_managing',
  therapist_culture_and_schemas: 'values',
};
