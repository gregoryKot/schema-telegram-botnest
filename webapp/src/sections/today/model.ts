import { indexLevel, type IndexLevel } from '../../lib/tone';
import { momentDayLabel, momentIsToday, momentTime } from '../../utils/format';
import { isCalendarDate } from '../../../../shared/src/utils/calendarDate';

// Чистые вычисления экрана «Сегодня»: дельта к вчера, индекс дня, история и
// столбики, последние записи, заголовок встречи.

// ── Потребности: дельта к вчера, индекс дня ─────────────────────────────────

export interface DeltaView { text: string; up: boolean }

/** Дельта оценки к вчера. Нет одной из оценок или разницы нет — нечего показывать. */
export function deltaView(value: number | undefined, yesterday: number | undefined): DeltaView | null {
  if (value === undefined || yesterday === undefined) return null;
  const d = value - yesterday;
  if (d === 0) return null;
  const abs = Math.abs(d);
  return { text: `${d > 0 ? '↑' : '↓'}${Number.isInteger(abs) ? abs : abs.toFixed(1)}`, up: d > 0 };
}

/** Индекс дня — среднее по всем потребностям; пока не все оценены — null (не выдумываем число). */
export function dayIndex(needIds: string[], ratings: Record<string, number>): number | null {
  if (needIds.length === 0 || needIds.some(id => ratings[id] === undefined)) return null;
  return needIds.reduce((s, id) => s + ratings[id], 0) / needIds.length;
}

function avg(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** Средние по дням истории (по возрастанию дат) + сегодняшний день из живых оценок. */
export function buildHistory(
  days: Array<{ date: string; ratings: Record<string, number> }>,
  todayRatings: Record<string, number>,
): number[] {
  const live = Object.values(todayRatings);
  const liveAvg = live.length > 0 ? avg(live) : null;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const vals = sorted.map(d => {
    const rs = Object.values(d.ratings);
    if (momentIsToday(d.date) && liveAvg !== null) return liveAvg;
    return rs.length === 0 ? 0 : avg(rs);
  });
  if (!sorted.some(d => momentIsToday(d.date))) vals.push(liveAvg ?? 0);
  return vals;
}

/** Разница среднего за последние 7 дней и предыдущие 7; мало данных — null. */
export function weekDelta(history: number[]): number | null {
  if (history.length < 8) return null;
  const recent = history.slice(-7).filter(v => v > 0);
  const previous = history.slice(-14, -7).filter(v => v > 0);
  if (recent.length === 0 || previous.length === 0) return null;
  return avg(recent) - avg(previous);
}

export interface SparkBar { height: number; level: IndexLevel }

/** Столбики индекса за последние 14 дней: высота в % от 10, уровень — по indexLevel. */
export function sparkBars(history: number[]): SparkBar[] {
  return history.slice(-14).map(v => ({
    height: Math.max(0, Math.min(100, v * 10)),
    level: v > 0 ? indexLevel(v) : 'none',
  }));
}

// ── Последние записи ────────────────────────────────────────────────────────

export type DiaryKind = 'schema' | 'mode' | 'gratitude';
export interface RecentEntry { type: DiaryKind; label: string; time: string; dateStr: string }

interface DiarySources {
  schema: Array<{ trigger: string; createdAt: string }>;
  mode: Array<{ situation: string; createdAt: string }>;
  gratitude: Array<{ items: string[]; date: string }>;
}

/** Три последние записи из трёх дневников, свежие — первыми. */
export function mergeRecentEntries({ schema, mode, gratitude }: DiarySources): RecentEntry[] {
  const all = [
    ...schema.slice(0, 2).map(e => ({ type: 'schema' as const, label: e.trigger.slice(0, 50), time: momentTime(e.createdAt), dateStr: momentDayLabel(e.createdAt), sortKey: e.createdAt })),
    ...mode.slice(0, 2).map(e => ({ type: 'mode' as const, label: e.situation.slice(0, 50), time: momentTime(e.createdAt), dateStr: momentDayLabel(e.createdAt), sortKey: e.createdAt })),
    ...gratitude.slice(0, 2).map(e => ({ type: 'gratitude' as const, label: e.items[0]?.slice(0, 50) ?? 'Благодарность', time: '', dateStr: momentDayLabel(e.date), sortKey: e.date })),
  ];
  all.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return all.slice(0, 3).map(({ sortKey: _k, ...e }) => e);
}

export const DIARY_KIND_LABEL: Record<DiaryKind, string> = {
  schema: 'Схема', mode: 'Режим', gratitude: 'Благодарность',
};

// ── Встреча с терапевтом ────────────────────────────────────────────────────

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Момент встречи для показа. Только день (`2026-10-31` — дни встреч без
 * времени) — местная полночь: `new Date('2026-10-31')` дал бы полночь UTC,
 * то есть «· 03:00» в Москве и прошлый день западнее Гринвича. */
export function sessionMoment(value: string): Date {
  if (!isCalendarDate(value)) return new Date(value);
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Заголовок карточки встречи: «Сегодня · 14:00», «Завтра · 14:00», «Сб, 17 октября · 14:00»; без времени — без « · ЧЧ:ММ». */
export function meetingTitle(nextSession: string, now: number): string {
  const at = sessionMoment(nextSession);
  const time = isCalendarDate(nextSession) ? '' : ` · ${at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  const diff = Math.round((startOfDay(at.getTime()) - startOfDay(now)) / 86400000);
  if (diff === 0) return `Сегодня${time}`;
  if (diff === 1) return `Завтра${time}`;
  const dow = at.toLocaleDateString('ru-RU', { weekday: 'short' });
  const date = at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${dow[0].toUpperCase()}${dow.slice(1)}, ${date}${time}`;
}
