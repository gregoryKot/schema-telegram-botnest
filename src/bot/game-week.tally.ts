import { WEEK_CTA_PLACES } from '../analytics/game-week.constants';
import type { GameEventRow } from './game-metrics.tally';

/** Воронка новой игры «Неделя»: главы mon/wed/fri/sun/first, места зова hook/final/menu. */
export interface WeekMetrics {
  started: number; // начали «Понедельник»
  ctaShown: number; // увидели карточку после хука; показ финальной сюда не входит
  clicksBooking: number; // клики со всех мест: хук, финал, меню
  clicksApp: number;
  clicksOther: number; // клик без известной цели
  shares: number;
  wedStarted: number;
  wedDone: number; // прошли «Среду» до конца
  friStarted: number;
  friDone: number; // прошли «Пятницу» до конца
  sunStarted: number;
  sunDone: number; // прошли «Воскресенье» до конца
  firstStarted: number;
  firstDone: number; // прошли «Первую встречу» — конец игры
}

export const emptyWeek = (): WeekMetrics => ({
  started: 0,
  ctaShown: 0,
  clicksBooking: 0,
  clicksApp: 0,
  clicksOther: 0,
  shares: 0,
  wedStarted: 0,
  wedDone: 0,
  friStarted: 0,
  friDone: 0,
  sunStarted: 0,
  sunDone: 0,
  firstStarted: 0,
  firstDone: 0,
});

const isWeekPlace = (v: string | null): boolean =>
  v !== null && (WEEK_CTA_PLACES as readonly string[]).includes(v);

/** Строка новой игры → её счётчики; true, если строка поглощена. */
export function tallyWeekRow(
  w: WeekMetrics,
  row: GameEventRow,
  c: number,
): boolean {
  if (row.name === 'game_cta_shown' || row.name === 'game_share') {
    if (!isWeekPlace(row.place)) return false;
    if (row.name === 'game_share') w.shares += c;
    // Конец игры считает firstDone: показ финальной карточки воронку хука не раздувает.
    else if (row.place === 'hook') w.ctaShown += c;
    return true;
  }
  if (row.name === 'game_cta_click') {
    if (!isWeekPlace(row.place)) return false;
    if (row.target === 'booking') w.clicksBooking += c;
    else if (row.target === 'app') w.clicksApp += c;
    else w.clicksOther += c;
    return true;
  }
  if (row.name === 'game_chapter_start') {
    if (row.chapter === 'mon') w.started += c;
    else if (row.chapter === 'wed') w.wedStarted += c;
    else if (row.chapter === 'fri') w.friStarted += c;
    else if (row.chapter === 'sun') w.sunStarted += c;
    else if (row.chapter === 'first') w.firstStarted += c;
    else return false;
    return true;
  }
  if (row.name === 'game_chapter_done') {
    if (row.chapter === 'first') w.firstDone += c;
    else if (row.chapter === 'wed') w.wedDone += c;
    else if (row.chapter === 'fri') w.friDone += c;
    else if (row.chapter === 'sun') w.sunDone += c;
    else if (row.chapter !== 'mon') return false; // конец хука виден как показ карточки
    return true;
  }
  return false;
}
