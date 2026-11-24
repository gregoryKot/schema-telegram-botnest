import { pluralRu } from '../../../../../shared/src/utils/pluralRu';
import { fmtDate } from '../../../../../shared/src/utils/format';
import type { AdminDailyPoint, AdminTherapistRow } from '../../../../../shared/src/analytics/adminAnalytics';

const DAY_MS = 86_400_000;
const utcDay = (ms: number) => Math.floor(ms / DAY_MS);

export const daysWord = (n: number) => `${n} ${pluralRu(n, 'день', 'дня', 'дней')}`;
export const peopleWord = (n: number) => `${n} ${pluralRu(n, 'человек', 'человека', 'человек')}`;
export const timesWord = (n: number) => `${n} ${pluralRu(n, 'раз', 'раза', 'раз')}`;

/** «сегодня» / «вчера» / «N дней назад»; нет даты или мусор — null (экран сам пишет «—»). */
export function agoLabel(iso: string | null, now: Date): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return null;
  const d = Math.max(0, utcDay(now.getTime()) - utcDay(t));
  if (d === 0) return 'сегодня';
  if (d === 1) return 'вчера';
  return `${daysWord(d)} назад`;
}

export type TherapistSort = 'activity' | 'clients' | 'recent';
export const SORT_LABELS: Record<TherapistSort, string> = {
  activity: 'По активности', clients: 'По числу клиентов', recent: 'По давности захода',
};

const clientsCount = (r: AdminTherapistRow) => r.clients.active + r.clients.pending;
const lastMs = (r: AdminTherapistRow) => (r.lastActive ? Date.parse(r.lastActive) || 0 : 0);

export function sortTherapists(rows: AdminTherapistRow[], mode: TherapistSort): AdminTherapistRow[] {
  const by: Record<TherapistSort, (a: AdminTherapistRow, b: AdminTherapistRow) => number> = {
    activity: (a, b) => b.total - a.total || b.activeDays - a.activeDays,
    clients: (a, b) => clientsCount(b) - clientsCount(a),
    recent: (a, b) => lastMs(b) - lastMs(a),
  };
  return [...rows].sort((a, b) => by[mode](a, b) || a.name.localeCompare(b.name, 'ru'));
}

export type ChartSeries = 'active' | 'newUsers' | 'events';
export const SERIES_LABELS: Record<ChartSeries, string> = { active: 'Заходили', newUsers: 'Новые', events: 'Действия' };
const SERIES_SENTENCE: Record<ChartSeries, string> = { active: 'заходили', newUsers: 'новых', events: 'действий' };

export const seriesValues = (daily: AdminDailyPoint[], s: ChartSeries): number[] => daily.map((p) => p[s]);

/** Высота столбика в процентах от максимума; пустой ряд — нули, не NaN. */
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.round((v / max) * 100) : 0));
}

/** Какой столбик под точкой x: ширина 0 или пустой ряд — -1. */
export function indexFromX(x: number, left: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return -1;
  return Math.min(count - 1, Math.max(0, Math.floor(((x - left) / width) * count)));
}

export function dayReadout(p: AdminDailyPoint, s: ChartSeries): string {
  return `${fmtDate(p.date)}: ${SERIES_SENTENCE[s]} ${p[s]}`;
}
