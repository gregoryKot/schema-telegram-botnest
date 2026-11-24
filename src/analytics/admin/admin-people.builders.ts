// Чистые сборщики «Людей» и общее имя человека для админки.
import type { AdminPersonRow } from './admin-analytics.types';
import { featureOf } from './admin-feature-dictionary';
import type { EventUserCount } from './admin-overview.builders';

export const PEOPLE_LIMIT = 50;
export const NO_NAME = 'Без имени';

/** Имя в заявке терапевта, иначе имя из мессенджера, иначе заглушка. */
export function resolveName(
  requestName: string | null | undefined,
  firstName: string | null | undefined,
): string {
  return requestName?.trim() || firstName?.trim() || NO_NAME;
}

export interface TopPerson {
  userId: bigint;
  events: number;
  /** До трёх самых частых фич человека. */
  top: Array<{ title: string; count: number }>;
}

/** Топ людей по числу действий; пустая выборка — пустой список. */
export function topPeople(
  rows: EventUserCount[],
  limit = PEOPLE_LIMIT,
): TopPerson[] {
  const byUser = new Map<
    string,
    { userId: bigint; events: number; feat: Map<string, number> }
  >();
  for (const r of rows) {
    if (r.userId === null) continue;
    const key = String(r.userId);
    const cur = byUser.get(key) ?? {
      userId: r.userId,
      events: 0,
      feat: new Map(),
    };
    cur.events += r.count;
    const title = featureOf(r.name).title;
    cur.feat.set(title, (cur.feat.get(title) ?? 0) + r.count);
    byUser.set(key, cur);
  }
  return [...byUser.values()]
    .sort((a, b) => b.events - a.events || (a.userId < b.userId ? -1 : 1))
    .slice(0, limit)
    .map((p) => ({
      userId: p.userId,
      events: p.events,
      top: [...p.feat.entries()]
        .map(([title, count]) => ({ title, count }))
        .sort(
          (a, b) => b.count - a.count || a.title.localeCompare(b.title, 'ru'),
        )
        .slice(0, 3),
    }));
}

export interface PersonInfo {
  role: 'CLIENT' | 'THERAPIST';
  name: string;
  activeDays: number;
  lastActive: string | null;
}

export function buildPeopleRows(
  top: TopPerson[],
  info: ReadonlyMap<string, PersonInfo>,
): AdminPersonRow[] {
  return top.map((p) => {
    const i = info.get(String(p.userId));
    return {
      id: String(p.userId),
      name: i?.name ?? NO_NAME,
      role: i?.role ?? 'CLIENT',
      activeDays: i?.activeDays ?? 0,
      events: p.events,
      lastActive: i?.lastActive ?? null,
      top: p.top,
    };
  });
}
