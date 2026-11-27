// Знаки разделов «Для терапевта» по Бехари («Обезоружить нарцисса»): опасный партнёр клиента —
// знак стадии «Безопасность» пути терапии: прежде работы над отношениями — безопасность и план выхода.
import type { GuideSign } from './guideSignsModel';

export const BEHARY_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  dangerous_partner: 'path_safety', forgiveness_after_betrayal: 'courtroom', couple_separation_decision: 'plan_ahead',
};
