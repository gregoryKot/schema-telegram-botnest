// Знаки «Для терапевта» по книге о парах: этапы — колонки жизни, сессия — разрыв и примирение, безопасность терапевта — взгляд сверху.
import type { GuideSign } from './guideSignsModel';

export const COUPLES_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  couple_therapy_stages: 'life_columns',
  couple_session_setup: 'rupture_mend',
  couples_therapist_safety: 'stand_above',
};
