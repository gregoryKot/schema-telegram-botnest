// Чистая логика списка клиентов терапевта: фильтры, порядок, подписи. today —
// местный день терапевта (nextSession — его настенное время); активность — по
// календарю клиента, isActiveToday/daysSinceActive от сервера (QA 2026-10-26).
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import {
  DAY_NAMES,
  isActiveToday,
  isVirtualClient,
  nextSessionLabel,
} from './clientSheetHelpers';
import { clientActivityLabel } from '../../../../shared/src/therapy/clientActivity';
import { matchesRosterSearch, plannedSession } from './rosterOrder';

// Порядок списка и метка статуса — rosterOrder (общие с сайдбаром и палитрой).
export { clientStatus, sortRoster } from './rosterOrder';

export type RosterStatus = 'all' | 'active' | 'wait' | 'virtual';

export function filterRoster(
  clients: TherapyClientSummary[],
  query: string,
  status: RosterStatus,
): TherapyClientSummary[] {
  return clients.filter((c) => {
    if (!matchesRosterSearch(c, query)) return false;
    const activeToday = isActiveToday(c);
    if (status === 'active') return activeToday;
    if (status === 'wait') return !isVirtualClient(c) && !activeToday;
    if (status === 'virtual') return isVirtualClient(c);
    return true;
  });
}

/** «Вт, 7 окт · 11:00», «по Вт, Чт» или null, если встреч нет. */
export function meetingLabel(c: TherapyClientSummary, today: string): string | null {
  const at = plannedSession(c, today);
  if (at) return nextSessionLabel(at) || null;
  const days = [...new Set(c.meetingDays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (days.length === 0) return null;
  return `по ${days.map((d) => DAY_NAMES[d]).join(', ')}`;
}

/** Активность в строке клиента: давность по календарю клиента («активность сегодня»); у офлайн-карточки — «офлайн». */
export function rosterActivity(c: TherapyClientSummary): string {
  return clientActivityLabel(c) ?? 'офлайн';
}

/** Ближайшая встреча в строке клиента; нет — «—». */
export const rosterMeeting = (c: TherapyClientSummary, today: string): string => meetingLabel(c, today) ?? '—';

/** Схемы строкой (К31): до двух — именем до «/», остальные — «ещё N»; неизвестные id пропускаем. */
export function rosterSchemas(schemaIds: string[]): string {
  const ids = new Set(schemaIds);
  const names = SCHEMA_DOMAINS.flatMap((d) => d.schemas.filter((s) => ids.has(s.id)).map((s) => s.name.split(' / ')[0]));
  return (names.length <= 2 ? names : [...names.slice(0, 2), `ещё\u00a0${names.length - 2}`]).join('\u00a0· ');
}
