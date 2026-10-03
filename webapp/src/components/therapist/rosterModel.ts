// Чистая логика списка клиентов терапевта: фильтры, порядок, подписи.
// Календарные дни — строки 'YYYY-MM-DD', today приходит параметром
// (правило №25: никакой локальной полуночи машины).
import type { TherapyClientSummary } from '../../api';
import {
  DAY_NAMES,
  calcTherapyDuration,
  isVirtualClient,
  nextSessionLabel,
} from './clientSheetHelpers';

export type RosterStatus = 'all' | 'active' | 'wait' | 'virtual';

const sessionDay = (nextSession: string): string => nextSession.split('T')[0];

/** Ближайшая встреча не в прошлом — иначе null (прошедшую не показываем). */
function upcomingSession(c: TherapyClientSummary, today: string): string | null {
  if (!c.nextSession) return null;
  return sessionDay(c.nextSession) >= today ? c.nextSession : null;
}

const displayName = (c: TherapyClientSummary): string => c.clientAlias ?? c.name ?? '';

export function filterRoster(
  clients: TherapyClientSummary[],
  query: string,
  status: RosterStatus,
  today: string,
): TherapyClientSummary[] {
  const q = query.toLowerCase().trim();
  return clients.filter((c) => {
    if (q && !displayName(c).toLowerCase().includes(q)) return false;
    const activeToday = c.lastActiveDate === today;
    if (status === 'active') return activeToday;
    if (status === 'wait') return !isVirtualClient(c) && !activeToday;
    if (status === 'virtual') return isVirtualClient(c);
    return true;
  });
}

/** Сначала у кого скоро встреча (по возрастанию), затем остальные по имени. */
export function sortRoster(
  clients: TherapyClientSummary[],
  today: string,
): TherapyClientSummary[] {
  const withMeeting: { c: TherapyClientSummary; at: string }[] = [];
  const rest: TherapyClientSummary[] = [];
  for (const c of clients) {
    const at = upcomingSession(c, today);
    if (at) withMeeting.push({ c, at });
    else rest.push(c);
  }
  withMeeting.sort((a, b) => a.at.localeCompare(b.at));
  rest.sort((a, b) => displayName(a).localeCompare(displayName(b), 'ru'));
  return [...withMeeting.map((x) => x.c), ...rest];
}

/** «Вт, 7 окт · 11:00», «по Вт, Чт» или null, если встреч нет. */
export function meetingLabel(c: TherapyClientSummary, today: string): string | null {
  const at = upcomingSession(c, today);
  if (at) return nextSessionLabel(at) || null;
  const days = [...new Set(c.meetingDays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (days.length === 0) return null;
  return `по ${days.map((d) => DAY_NAMES[d]).join(', ')}`;
}

/** Строка под именем клиента. */
export function clientSubline(c: TherapyClientSummary, today: string): string {
  if (isVirtualClient(c)) {
    const duration = c.therapyStartDate ? calcTherapyDuration(c.therapyStartDate) : '';
    if (!duration) return 'оффлайн';
    if (duration === 'сегодня') return 'оффлайн · с сегодняшнего дня';
    return `оффлайн · в работе ${duration}`;
  }
  const activity =
    c.lastActiveDate === today ? 'активен сегодня' : c.lastActiveDate ? 'был недавно' : 'не активен';
  return c.streak > 0 ? `${activity} · стрик ${c.streak} дн.` : activity;
}
