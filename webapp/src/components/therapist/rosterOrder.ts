// Порядок, поиск и метка статуса клиентов терапевта — одни для «Все клиенты»
// (rosterModel), сайдбара кабинета (appShell/SidebarClients) и поиска-палитры
// (CommandPalette). Отдельно от rosterModel намеренно: сайдбар и палитра живут
// в основном чанке, а фильтры статусов, подписи и данные схем им не нужны —
// их импорт перекраивал общие чанки бандла.
// today — местный день терапевта: nextSession — его настенное время (№25).
import type { TherapyClientSummary } from '../../api';
import { isVirtualClient } from '../../../../shared/src/therapy/clientSheetHelpers';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { matchesSearch } from '../../../../shared/src/utils/searchNormalize';
import { clientDisplayName as displayName } from '../../../../shared/src/therapy/clientInitials';

/** Статус: клиент с аккаунтом (ok) или офлайн-карточка — одна метка для списка, палитры и шапки
 *  клиента. «В приложении», а не «в боте»: клиент сайта в боте не бывает (аудит 2026-11, U11). */
export const clientStatus = (c: TherapyClientSummary): { label: string; inBot: boolean } =>
  isVirtualClient(c) ? { label: 'офлайн', inBot: false } : { label: 'в приложении', inBot: true };

/** Явная встреча не в прошлом — иначе null; дни встреч список подписывает «по Вт». */
export const plannedSession = (c: TherapyClientSummary, today: string): string | null =>
  upcomingSession(c.nextSession, [], today);

/** Поиск по той же подписи, что видна в списке (алиас → имя → «Без имени · id»), без регистра и «ё/е». */
export const matchesRosterSearch = (c: TherapyClientSummary, query: string): boolean =>
  matchesSearch(displayName(c), query);

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
