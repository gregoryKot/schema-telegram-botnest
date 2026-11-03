// Порядок и поиск клиентов терапевта — одни для «Все клиенты» (rosterModel)
// и сайдбара кабинета (appShell/SidebarClients). Отдельно от rosterModel
// намеренно: сайдбар живёт в основном чанке, а фильтры статусов, подписи и
// данные схем ему не нужны — их импорт перекраивал общие чанки бандла.
// today — местный день терапевта: nextSession — его настенное время (№25).
import type { TherapyClientSummary } from '../../api';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { matchesSearch } from '../../../../shared/src/utils/searchNormalize';

/** Явная встреча не в прошлом — иначе null; дни встреч список подписывает «по Вт». */
export const plannedSession = (c: TherapyClientSummary, today: string): string | null =>
  upcomingSession(c.nextSession, [], today);

const displayName = (c: TherapyClientSummary): string => c.clientAlias ?? c.name ?? '';

/** Поиск по алиасу, иначе по имени — без регистра и «ё/е»; пустой запрос подходит всем. */
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
