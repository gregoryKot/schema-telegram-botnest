// Знаки разделов «Для терапевта» по Арнцу и ван Гендерен (ПРЛ, пачка 12 карты; сверка — guideSignsModel.test.tsx).
// Готовые мотивы кабинета заняты, берутся знаки приложения с тем же смыслом: задание не сделано —
// Strokes (регулярности при ПРЛ сначала не ждут), кризис — Grounded, смена режимов — Wheel. Арнтц и Якоб: стиль копинга — знак капитуляции (два других у Янга), семья режима по чувству — Expression (волна-голос), схема/режим/установка — «осознание» пути.
import type { GuideSign } from './guideSignsModel';

export const ARNTZ_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  homework_not_done: 'strokes',
  crisis_call: 'grounded',
  mode_flipping: 'wheel',
  coping_style_in_session: 'coping_surrender', mode_family_by_feeling: 'need_expression', schema_vs_mode_vs_belief: 'path_awareness',
};
