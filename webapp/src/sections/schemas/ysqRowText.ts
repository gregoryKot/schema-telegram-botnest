import { fmtDate, momentDayKey } from '../../utils/format';

export interface YsqRowText { sub: string; action: string; primary: boolean }

/** Подпись и кнопка строки теста: незаконченный прогресс приоритетнее результата. */
export function ysqRowText(progressAnswered: number | null, completedAt: string | null, tr: (ty: string, vy: string) => string): YsqRowText {
  if (progressAnswered !== null) return { sub: `Начат · отвечено ${progressAnswered} из 116`, action: 'Продолжить', primary: true };
  if (completedAt) return { sub: `Пройден ${fmtDate(momentDayKey(completedAt))} · результаты внутри`, action: 'Результаты', primary: false };
  return { sub: tr('Определи схемы автоматически · 116 вопросов', 'Определите схемы автоматически · 116 вопросов'), action: 'Начать', primary: true };
}
