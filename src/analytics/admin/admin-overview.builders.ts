// Чистые сборщики общей сводки админки: дни окна, дневной ряд, фичи.
import { localDate } from '../../utils/tz';
import type { AdminDailyPoint, AdminFeatureRow } from './admin-analytics.types';
import { featureOf } from './admin-feature-dictionary';

/** Зона отчёта: как в /stats (bot.admin-stats.service.ts). */
export const REPORT_TZ = 'Europe/Moscow';

const DAY_MS = 86_400_000;

/** Календарный день момента в зоне отчёта, YYYY-MM-DD. */
export function reportDay(at: Date): string {
  return localDate(REPORT_TZ, at);
}

/** Дни окна от старого к новому, последний — `today`; без пропусков. */
export function windowDates(days: number, today: string): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) =>
    new Date(end - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  );
}

/** Сколько моментов попало в каждый день окна (чужие дни отбрасываются). */
export function bucketByDay(dates: string[], moments: Date[]): number[] {
  const index = new Map(dates.map((d, i) => [d, i]));
  const out = dates.map(() => 0);
  for (const m of moments) {
    const i = index.get(reportDay(m));
    if (i !== undefined) out[i]++;
  }
  return out;
}

export function buildDaily(
  dates: string[],
  src: {
    active: ReadonlyMap<string, number>;
    newUsers: number[];
    events: ReadonlyMap<string, number>;
  },
): AdminDailyPoint[] {
  return dates.map((date, i) => ({
    date,
    active: src.active.get(date) ?? 0,
    newUsers: src.newUsers[i] ?? 0,
    events: src.events.get(date) ?? 0,
  }));
}

export interface EventUserCount {
  name: string;
  userId: bigint | null;
  count: number;
}

/** Фичи по убыванию действий: действия склеены по словарю, люди — разные. */
export function buildFeatures(rows: EventUserCount[]): AdminFeatureRow[] {
  const acc = new Map<
    string,
    { title: string; events: number; users: Set<string> }
  >();
  for (const r of rows) {
    const f = featureOf(r.name);
    const cur = acc.get(f.id) ?? {
      title: f.title,
      events: 0,
      users: new Set(),
    };
    cur.events += r.count;
    if (r.userId !== null) cur.users.add(String(r.userId));
    acc.set(f.id, cur);
  }
  return [...acc.entries()]
    .map(([id, v]) => ({
      id,
      title: v.title,
      events: v.events,
      users: v.users.size,
    }))
    .sort(
      (a, b) => b.events - a.events || a.title.localeCompare(b.title, 'ru'),
    );
}
