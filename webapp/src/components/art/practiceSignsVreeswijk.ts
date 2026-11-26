// Знаки «Для терапевта» по ван Фресвайку: протокол тренинга — знак трёхминутной паузы (короткая практика встречи);
// программы осознанности (MBSR, MBCT) — знак скана тела, их общей практики.
import type { GuideSign } from './guideSignsModel';
export const VREESWIJK_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  mbst_protocol: 'breathing_space',
  mindfulness_programs: 'body_scan',
};
