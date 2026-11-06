// Вкладки кабинета живут в адресе (владелец, 2026-11): перезагрузка и ссылка
// открывают ту же вкладку. Карточка клиента — /cabinet/<код>/<слаг> («Обзор» —
// без слага), доска «Задания» списка — /cabinet/tasks. Единственное место, где
// живёт соответствие вкладки и слага; синхронизация с состоянием карточки —
// useClientTabRoute, часть адреса с клиентом — shared/src/utils/clientRef.
import type { ClientTab } from './clientSheetTypes';
import { parseClientRef } from '../../../../shared/src/utils/clientRef';

const SLUG: Record<ClientTab, string> = {
  overview: '', concept: 'concept', mode_map: 'maps', sessions: 'sessions',
  tasks: 'tasks', ysq: 'schemas', client_notes: 'notes',
};

export type ListTab = 'clients' | 'kanban';
/** Доска «Задания» списка клиентов. `tasks` не пройдёт как клиент: parseClientRef('tasks') — null. */
export const LIST_TASKS_PATH = '/cabinet/tasks';

export function slugOfTab(tab: ClientTab): string {
  return SLUG[tab];
}

/** Слаг из адреса → вкладка; пустой и неизвестный — null (карточка откроется на «Обзоре»). */
export function tabFromSlug(slug: string | undefined | null): ClientTab | null {
  if (!slug) return null;
  return (Object.keys(SLUG) as ClientTab[]).find((t) => SLUG[t] === slug) ?? null;
}

/** Адрес карточки: ref (код или id) + слаг вкладки. */
export function clientCardPath(ref: string, tab: ClientTab): string {
  const slug = slugOfTab(tab);
  return '/cabinet/' + ref + (slug ? '/' + slug : '');
}

/** Вкладка карточки из адреса /cabinet/<ref>/<слаг>; не карточка или без слага — null. */
export function clientTabFromPath(pathname: string): ClientTab | null {
  const m = pathname.match(/^\/cabinet\/([^/]+)\/([^/]+)$/);
  return m && parseClientRef(m[1]) ? tabFromSlug(m[2]) : null;
}

/** Адрес — список клиентов (на любой его вкладке). */
export function isClientListPath(pathname: string): boolean {
  return pathname === '/cabinet' || pathname === LIST_TASKS_PATH;
}

export function listTabFromPath(pathname: string): ListTab {
  return pathname === LIST_TASKS_PATH ? 'kanban' : 'clients';
}

export function listTabPath(tab: ListTab): string {
  return tab === 'kanban' ? LIST_TASKS_PATH : '/cabinet';
}
