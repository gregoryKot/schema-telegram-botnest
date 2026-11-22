// Знаки разделов «Для терапевта» по Арнцу и ван Гендерен (ПРЛ, пачка 12 карты; сверка — guideSignsModel.test.tsx).
// Готовые мотивы кабинета заняты, берутся знаки приложения с тем же смыслом: задание не сделано —
// Strokes (полоски трекера: регулярности при ПРЛ сначала не ждут), кризис — Grounded (сначала
// успокоить и заземлить, решения потом), смена режимов — Wheel (полоски по кругу, у руля то одна, то другая).
import type { GuideSign } from './guideSignsModel';

export const ARNTZ_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  homework_not_done: 'strokes',
  crisis_call: 'grounded',
  mode_flipping: 'wheel',
};
