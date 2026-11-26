// Подписи шага времени и листа «Запланировано» (PlanConfirm, PlanDone): час — «09:00», когда — «Днём · 13:00»
// или «Без напоминания». Слова — из REMINDER_OPTIONS, своих нет.
import { REMINDER_OPTIONS } from '../../../../shared/src/practices/usePlanSheetState';

export const reminderHour = (h: number): string => `${String(h).padStart(2, '0')}:00`;

export function planWhen(idx: number): string {
  const opt = REMINDER_OPTIONS[idx];
  if (!opt) return '';
  return opt.localHour === null ? opt.label : `${opt.label} · ${reminderHour(opt.localHour)}`;
}
