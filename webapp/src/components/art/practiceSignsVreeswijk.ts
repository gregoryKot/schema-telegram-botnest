// Знаки «Для терапевта» по ван Фресвайку: паузы, сессии и скан тела.
import type { GuideSign } from './guideSignsModel';
export const VREESWIJK_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  mbst_protocol: 'breathing_space',
  mbst_sessions: 'plan_ahead',
  mindfulness_programs: 'body_scan',
};
