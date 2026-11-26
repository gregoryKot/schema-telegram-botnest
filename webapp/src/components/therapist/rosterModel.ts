// Чистая логика списка клиентов терапевта: фильтры, порядок, подписи. today —
// местный день терапевта (nextSession — его настенное время); активность — по
// календарю клиента, isActiveToday/daysSinceActive от сервера (QA 2026-10-26).
import type { TherapyClientSummary } from '../../api';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import {
  DAY_NAMES,
  calcTherapyDuration,
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

/** Подпись под именем: срок в работе или (для бот-клиента) активность — та же, что на «Сегодня». */
export function clientCaption(c: TherapyClientSummary): string | null {
  const duration = c.therapyStartDate ? calcTherapyDuration(c.therapyStartDate) : '';
  if (duration === 'сегодня') return 'с сегодняшнего дня';
  if (duration) return `в работе ${duration}`;
  const activity = clientActivityLabel(c); // офлайн-клиент — null
  if (!activity) return null;
  return c.streak > 0 ? `${activity} · стрик ${c.streak} дн.` : activity;
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

