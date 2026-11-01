import type { ClientTab } from './clientSheetTypes';

// Панель «+ Задание / + Заметка» на телефоне закреплена над навигацией и видна
// на всех вкладках карточки. На «Концептуализации» и «Карте режимов» она лишняя:
// там работают со схемой, а панель отъедала экран (#902, скриншот владельца).
// Модификатор на корне .tk-head читает therapist-card.css (<768px); на ноутбуке
// он ничего не меняет.
const QUIET_ACTION_TABS: ReadonlySet<ClientTab> = new Set<ClientTab>(['concept', 'mode_map']);

/** Класс корня шапки карточки клиента; с модификатором панель действий на телефоне не показывается. */
export function clientHeaderClass(tab: ClientTab): string {
  return QUIET_ACTION_TABS.has(tab) ? 'tk-head tk-head--quiet-actions' : 'tk-head';
}
