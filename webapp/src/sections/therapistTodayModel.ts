// Чистые вычисления экрана «Сегодня» кабинета терапевта: счётчики, статус
// активности клиента, точки спарклайна. Всё считается только из
// TherapyClientSummary, который экран уже получает. Два разных «сегодня»
// (QA 2026-10-26): активность — по календарю КЛИЕНТА (daysSinceActive и
// todayIndex считает сервер в его зоне), сессии — по местному дню терапевта
// (nextSession — его настенное время).
import type { TherapyClientSummary } from '../api';
import { isSessionToday, upcomingSession } from '../../../shared/src/therapy/upcomingSession';
import { indexLevel, type IndexLevel } from '../lib/tone';
/** С какого числа дней без активности клиент попадает в «Требуют внимания». */
export const ATTENTION_DAYS = 3;

export const clientName = (c: TherapyClientSummary): string =>
  c.clientAlias ?? c.name ?? `#${c.telegramId}`;

/** Инициалы для аватара: до двух первых букв слов имени; «#123» -> «#». */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map(w => Array.from(w)[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

/** Дней от последней оценки до сегодня клиента (его календарь); null — не было. */
export function daysSinceActive(c: TherapyClientSummary): number | null {
  return c.daysSinceActive ?? null;
}

/** Ближайшая встреча сегодня: будущий nextSession важнее дней, прошедший — нет. */
const sessionToday = (c: TherapyClientSummary): string | null => {
  const at = upcomingSession(c.nextSession, c.meetingDays);
  return isSessionToday(at) ? at : null;
};
export const hasSessionToday = (c: TherapyClientSummary): boolean => sessionToday(c) !== null;

/** HH:MM сегодняшней встречи; без времени или не сегодня — пустая строка. */
export const sessionTime = (c: TherapyClientSummary): string => sessionToday(c)?.split('T')[1]?.slice(0, 5) ?? '';

/** Сессии сегодня по времени; без времени — в конце. */
export function sessionsTodaySorted(clients: TherapyClientSummary[]): TherapyClientSummary[] {
  return clients
    .filter(hasSessionToday)
    .sort((a, b) => (sessionTime(a) || '99:99').localeCompare(sessionTime(b) || '99:99'));
}

/** Не заполнили сегодня и молчат 3+ дня (или записей не было вовсе). */
export function needsAttention(c: TherapyClientSummary): boolean {
  if (c.todayIndex != null) return false;
  const days = daysSinceActive(c);
  return days == null || days >= ATTENTION_DAYS;
}

export interface TodayCounts { active: number; total: number; sessions: number; attention: number }

export function todayCounts(clients: TherapyClientSummary[]): TodayCounts {
  return {
    active: clients.filter(c => c.todayIndex != null).length,
    total: clients.length,
    sessions: clients.filter(hasSessionToday).length,
    attention: clients.filter(needsAttention).length,
  };
}

export interface ActivityStatus { text: string; tone: 'ok' | 'warn' | 'none' }

export function activityStatus(c: TherapyClientSummary): ActivityStatus {
  if (c.todayIndex != null) return { text: 'активность сегодня', tone: 'ok' };
  const days = daysSinceActive(c);
  if (days == null) return { text: 'нет данных', tone: 'warn' };
  if (days === 0) return { text: 'активность сегодня', tone: 'ok' };
  if (days === 1) return { text: 'активность вчера', tone: 'none' };
  if (days < ATTENTION_DAYS) return { text: `активность ${days} дн. назад`, tone: 'none' };
  return { text: `нет активности ${days} дн.`, tone: 'warn' };
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
