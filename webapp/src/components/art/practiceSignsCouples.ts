// Знаки «Для терапевта» по книге о парах: этапы терапии — шаблон пути, парная сессия — разрыв и примирение в сессии.
import type { GuideSign } from './guideSignsModel';

export const COUPLES_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  couple_therapy_stages: 'path_template',
  couple_session_setup: 'rupture_mend',
};
