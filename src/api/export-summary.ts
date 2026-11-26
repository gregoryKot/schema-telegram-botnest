import type { Need, NeedId } from '../bot/bot.service';
import { plural } from '../bot/plural';

// Текст «Сводки для терапевта» (GET /api/export): сайт и мини-апп показывают
// его как есть и дают скопировать. Вынесено из tracker.controller.ts чистой
// функцией ради пустого состояния: на чистом аккаунте сводка говорила
// «последние 0 дней … Серия: 1 дн.» (QA 2026-11-03) — ноль дней в шапке
// и серия, выданная за одно открытие сайта.

/** За сколько дней собирается сводка. */
export const EXPORT_DAYS = 30;

export interface ExportDay {
  date: string;
  ratings: Partial<Record<NeedId, number>>;
}

export interface ExportStreak {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
}

const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

/** `history` — только дни с оценками, новые первыми (getHistoryRatings). */
export function buildExportSummary(
  needs: Need[],
  history: ExportDay[],
  streak: ExportStreak,
): string {
  const head =
    history.length > 0
      ? `📔 Трекер потребностей · за ${EXPORT_DAYS} дней заполнено ${days(history.length)}`
      : `📔 Трекер потребностей · за ${EXPORT_DAYS} дней`;
  const lines: string[] = [head, ''];
  if (history.length === 0) lines.push('Оценок в трекере за эти дни нет.');
  for (const day of [...history].reverse()) {
    const vals = needs.map((n) => {
      const v = day.ratings[n.id];
      return v !== undefined ? `${n.emoji} ${v}/10` : `${n.emoji} –`;
    });
    lines.push(`${day.date}: ${vals.join('  ')}`);
  }
  // Серия считается по любым записям (трекер, дневники), поэтому может быть
  // и без оценок за месяц; нулевую не показываем — сказать ею нечего.
  if (streak.totalDays > 0) {
    lines.push('');
    lines.push(
      `Серия: ${days(streak.currentStreak)} · Рекорд: ${days(streak.longestStreak)} · Всего: ${days(streak.totalDays)}`,
    );
  }
  return lines.join('\n');
}
