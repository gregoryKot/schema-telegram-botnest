// Чистые вычисления экрана «Сегодня» кабинета терапевта из TherapyClientSummary:
// счётчики, статус активности (по календарю КЛИЕНТА — daysSinceActive и todayIndex
// считает сервер), спарклайн; сессии — по местному дню терапевта (QA 2026-10-26).
import type { TherapyClientSummary } from '../api';
import { momentDayKey, momentTime, todayStr } from '../utils/format';
import { upcomingSession } from '../../../shared/src/therapy/upcomingSession';
import { clientActivityLabel } from '../../../shared/src/therapy/clientActivity';
import { isVirtualClient } from '../../../shared/src/therapy/clientSheetHelpers';
import { indexLevel, type IndexLevel } from '../lib/tone';

/** С какого числа дней без активности клиент попадает в «Требуют внимания». */
export const ATTENTION_DAYS = 3;

/** Дней от последней оценки до сегодня клиента (его календарь); null — не было. */
export function daysSinceActive(c: TherapyClientSummary): number | null {
  return c.daysSinceActive ?? null;
}

/** Встреча сегодня — по МЕСТНОМУ дню терапевта (правило №25): встреча — момент
 *  (datetime-local без зоны), по UTC в МСК 00–03 «сегодня» показывало вчерашние. */
const sessionToday = (c: TherapyClientSummary): string | null => {
  const today = todayStr();
  const at = upcomingSession(c.nextSession, c.meetingDays, today);
  return at && momentDayKey(at) === today ? at : null;
};
export const hasSessionToday = (c: TherapyClientSummary): boolean => sessionToday(c) !== null;
/** HH:MM сегодняшней встречи в зоне терапевта; без времени или не сегодня — ''. */
export const sessionTime = (c: TherapyClientSummary): string => momentTime(sessionToday(c) ?? '');

/** Сессии сегодня по времени; без времени — в конце. */
export function sessionsTodaySorted(clients: TherapyClientSummary[]): TherapyClientSummary[] {
  return clients
    .filter(hasSessionToday)
    .sort((a, b) => (sessionTime(a) || '99:99').localeCompare(sessionTime(b) || '99:99'));
}

/** Клиенты с аккаунтом: у офлайн-клиента активности не бывает, и он не входит ни
 *  в «Активны N / M», ни в «Требуют внимания», ни в «Активность клиентов» (QA 2026-11). */
export const trackedClients = (clients: TherapyClientSummary[]): TherapyClientSummary[] =>
  clients.filter(c => !isVirtualClient(c));

/** Не заполнили сегодня и молчат 3+ дня (или записей не было вовсе); офлайн — никогда. */
export function needsAttention(c: TherapyClientSummary): boolean {
  if (isVirtualClient(c) || c.todayIndex != null) return false;
  const days = daysSinceActive(c);
  return days == null || days >= ATTENTION_DAYS;
}

export interface TodayCounts { active: number; total: number; sessions: number; attention: number }

/** Сессии — по всем клиентам (встреча с офлайн-клиентом настоящая), остальное — по trackedClients. */
export function todayCounts(clients: TherapyClientSummary[]): TodayCounts {
  const tracked = trackedClients(clients);
  return {
    active: tracked.filter(c => c.todayIndex != null).length,
    total: tracked.length,
    sessions: clients.filter(hasSessionToday).length,
    attention: tracked.filter(needsAttention).length,
  };
}

export interface ActivityStatus { text: string; tone: 'ok' | 'warn' | 'none' }

/** Текст — общая подпись кабинета (clientActivityLabel), тон — сегодня / требует внимания. */
export function activityStatus(c: TherapyClientSummary): ActivityStatus {
  const text = clientActivityLabel(c) ?? '';
  if (c.todayIndex != null || daysSinceActive(c) === 0) return { text, tone: 'ok' };
  return { text, tone: needsAttention(c) ? 'warn' : 'none' };
}

export interface SparkPoint { height: number; level: IndexLevel }

/** 14 точек от старой к новой (recentIndexHistory: index 0 = сегодня). Высота — % от 10. */
export function sparkPoints(history: (number | null)[]): SparkPoint[] {
  const pts = history.slice(0, 14).map((v): SparkPoint => ({
    height: v == null ? 0 : Math.max(8, Math.min(100, Math.round(v * 10))),
    level: indexLevel(v),
  }));
  return pts.reverse();
}

/** Последний известный индекс: сегодняшний, иначе самый свежий из истории. */
export function latestIndex(c: TherapyClientSummary): number | null {
  if (c.todayIndex != null) return c.todayIndex;
  return c.recentIndexHistory.find(v => v != null) ?? null;
}
