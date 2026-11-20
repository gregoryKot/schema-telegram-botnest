import type { WeekMetrics } from './game-week.tally';

// Строки новой игры «Неделя» для блока «Игра» в /stats (правило №8): воронка
// от «Понедельника» до зова. Чистая функция; пусто — нет строк, а не нули.

export const isWeekEmpty = (w: WeekMetrics): boolean =>
  Object.values(w).every((n) => n === 0);

/** Доля нажавших зов от начавших, целым процентом; без начавших — null. */
export function weekCtaRate(w: WeekMetrics): number | null {
  if (w.started <= 0) return null;
  const clicks = w.clicksBooking + w.clicksApp + w.clicksOther;
  return Math.round((clicks / w.started) * 100);
}

export function formatWeekLines(w: WeekMetrics): string[] {
  if (isWeekEmpty(w)) return [];
  const parts = [
    `начали ${w.started}`,
    `дошли до карточки ${w.ctaShown}`,
    `нажали «записаться» ${w.clicksBooking}, «в приложение» ${w.clicksApp}`,
    `поделились ${w.shares}`,
  ];
  const lines = [`Новая игра «Неделя»: ${parts.join(' · ')}`];
  const next: string[] = [];
  if (w.wedStarted > 0) next.push(`пошли в «Среду» ${w.wedStarted}`);
  if (w.wedDone > 0) next.push(`прошли «Среду» ${w.wedDone}`);
  if (w.friStarted > 0) next.push(`пошли в «Пятницу» ${w.friStarted}`);
  if (w.friDone > 0) next.push(`прошли «Пятницу» ${w.friDone}`);
  if (w.firstDone > 0) next.push(`дошли до конца ${w.firstDone}`);
  if (next.length > 0) lines.push(`Дальше по неделе: ${next.join(' · ')}`);
  const rate = weekCtaRate(w);
  if (rate !== null) lines.push(`Нажали зов: ${rate}% от начавших`);
  return lines;
}
