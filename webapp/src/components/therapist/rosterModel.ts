// Чистая логика списка клиентов терапевта: фильтры, порядок, подписи.
// Календарные дни — строки 'YYYY-MM-DD', today приходит параметром
// (правило №25: никакой локальной полуночи машины).
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import {
  DAY_NAMES,
  calcTherapyDuration,
  isVirtualClient,
  nextSessionLabel,
} from './clientSheetHelpers';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';

export type RosterStatus = 'all' | 'active' | 'wait' | 'virtual';

/** Явная встреча не в прошлом — иначе null; дни встреч список подписывает «по Вт». */
const plannedSession = (c: TherapyClientSummary, today: string): string | null =>
  upcomingSession(c.nextSession, [], today);

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
    const at = plannedSession(c, today);
    if (at) withMeeting.push({ c, at });
    else rest.push(c);
  }
  withMeeting.sort((a, b) => a.at.localeCompare(b.at));
  rest.sort((a, b) => displayName(a).localeCompare(displayName(b), 'ru'));
  return [...withMeeting.map((x) => x.c), ...rest];
}

/** «Вт, 7 окт · 11:00», «по Вт, Чт» или null, если встреч нет. */
export function meetingLabel(c: TherapyClientSummary, today: string): string | null {
  const at = plannedSession(c, today);
  if (at) return nextSessionLabel(at) || null;
  const days = [...new Set(c.meetingDays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (days.length === 0) return null;
  return `по ${days.map((d) => DAY_NAMES[d]).join(', ')}`;
}

/** Подпись под именем: срок в работе или (для бот-клиента) активность. */
export function clientCaption(c: TherapyClientSummary, today: string): string | null {
  const duration = c.therapyStartDate ? calcTherapyDuration(c.therapyStartDate) : '';
  if (duration === 'сегодня') return 'с сегодняшнего дня';
  if (duration) return `в работе ${duration}`;
  if (isVirtualClient(c)) return null;
  const activity =
    c.lastActiveDate === today ? 'активность сегодня' : c.lastActiveDate ? 'активность недавно' : 'нет активности';
  return c.streak > 0 ? `${activity} · стрик ${c.streak} дн.` : activity;
}

/** Статус карточки: клиент в боте (ok) или оффлайн-карточка без бота. */
export function clientStatus(c: TherapyClientSummary): { label: string; inBot: boolean } {
  return isVirtualClient(c) ? { label: 'оффлайн', inBot: false } : { label: 'в боте', inBot: true };
}

export interface DomainSegment { domainId: string; count: number }

/** Полоса доменов: сегменты в порядке доменов, flex = число схем клиента в домене. */
export function domainBar(schemaIds: string[]): DomainSegment[] {
  const ids = new Set(schemaIds);
  return SCHEMA_DOMAINS
    .map((d) => ({ domainId: d.id, count: d.schemas.filter((s) => ids.has(s.id)).length }))
    .filter((seg) => seg.count > 0);
}

export interface SchemaChip { id: string; name: string; domainId: string }

/** Чипы всех известных схем клиента, сгруппированно по доменам. Неизвестные id пропускаем. */
export function schemaChips(schemaIds: string[]): SchemaChip[] {
  const ids = new Set(schemaIds);
  return SCHEMA_DOMAINS.flatMap((d) =>
    d.schemas.filter((s) => ids.has(s.id)).map((s) => ({ id: s.id, name: s.name, domainId: d.id })),
  );
}

/** Имя клиента для карточки: алиас → имя → ID. */
export const rosterName = (c: TherapyClientSummary): string =>
  c.clientAlias ?? c.name ?? `ID ${c.telegramId}`;

/** Две первые буквы слов имени для аватара; пусто → «?». */
export function rosterInitials(name: string): string {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((w) => Array.from(w)[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}
