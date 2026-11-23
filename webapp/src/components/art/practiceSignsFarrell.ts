// Знаки разделов «Для терапевта» по Фарреллу (групповая схема-терапия): подготовка к группе —
// «здоровая семья», принадлежность, поэтому знак потребности в привязанности (готовые мотивы кабинета заняты).
import type { GuideSign } from './guideSignsModel';

export const FARRELL_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  group_orientation: 'need_attachment',
};
