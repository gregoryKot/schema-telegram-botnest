// Чистый сборщик строк «Терапевты»: клиенты по статусам и действия за окно.
import {
  sumTherapistActions,
  type AdminTherapistActions,
  type AdminTherapistRow,
} from './admin-analytics.types';
import { bucketByDay } from './admin-overview.builders';
import { resolveName } from './admin-people.builders';

export type ActionKey = keyof AdminTherapistActions;

export interface TherapistInput {
  id: bigint;
  firstName: string | null;
  requestName: string | null;
}

export interface RelationInput {
  therapistId: bigint;
  status: 'pending' | 'active' | 'ended';
  clientId: bigint | null;
  virtualClientName: string | null;
}

export interface ActionStamp {
  therapistId: bigint;
  at: Date;
}

export interface ActivityInfo {
  activeDays: number;
  lastActive: string | null;
}

type Clients = AdminTherapistRow['clients'];

/** Офлайн-клиент (без аккаунта) считается отдельно, пока связь не завершена. */
export function countClients(relations: RelationInput[]): Clients {
  const c: Clients = { active: 0, pending: 0, ended: 0, virtual: 0 };
  for (const r of relations) {
    if (r.status === 'ended') c.ended++;
    else if (r.clientId === null && r.virtualClientName !== null) c.virtual++;
    else if (r.status === 'active') c.active++;
    else c.pending++;
  }
  return c;
}

const ACTION_KEYS: ActionKey[] = [
  'notes',
  'tasks',
  'planItems',
  'guideMarks',
  'conceptualizations',
  'customModes',
  'invites',
];

function groupBy<T extends { therapistId: bigint }>(
  items: T[],
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = String(it.therapistId);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/** Все терапевты, по убыванию числа действий за окно. */
export function buildTherapistRows(input: {
  dates: string[];
  therapists: TherapistInput[];
  relations: RelationInput[];
  actions: Record<ActionKey, ActionStamp[]>;
  activity: ReadonlyMap<string, ActivityInfo>;
}): AdminTherapistRow[] {
  const rels = groupBy(input.relations);
  const byAction = Object.fromEntries(
    ACTION_KEYS.map((k) => [k, groupBy(input.actions[k])]),
  ) as Record<ActionKey, Map<string, ActionStamp[]>>;

  const rows = input.therapists.map((t): AdminTherapistRow => {
    const id = String(t.id);
    const actions = {} as AdminTherapistActions;
    const daily = input.dates.map(() => 0);
    for (const k of ACTION_KEYS) {
      const stamps = byAction[k].get(id) ?? [];
      actions[k] = stamps.length;
      bucketByDay(
        input.dates,
        stamps.map((s) => s.at),
      ).forEach((n, i) => (daily[i] += n));
    }
    const act = input.activity.get(id);
    return {
      id,
      name: resolveName(t.requestName, t.firstName),
      lastActive: act?.lastActive ?? null,
      activeDays: act?.activeDays ?? 0,
      clients: countClients(rels.get(id) ?? []),
      actions,
      total: sumTherapistActions(actions),
      daily,
    };
  });
  return rows.sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ru'),
  );
}
