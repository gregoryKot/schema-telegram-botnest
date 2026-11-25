// Знаки «Для терапевта» по Фаррелл–Шоу (самопрактика): зачем — тропа с вехами («Обзор» пути); безопасность — узел
// на ленте (застрять и остановиться); форматы — рамка из трёх частей; рефлексия — ступени; обзор — флажки-вехи прогресса.
import type { GuideSign } from './guideSignsModel';

export const FARRELL_SHAW_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  self_practice_why: 'path_overview',
  self_practice_safety: 'path_stuck',
  self_practice_formats: 'path_session',
  self_practice_reflection: 'path_mode_order',
  self_practice_review: 'path_progress',
};
