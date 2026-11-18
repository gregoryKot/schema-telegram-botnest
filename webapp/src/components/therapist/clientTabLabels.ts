// Подписи вкладок карточки клиента в порядке показа: одни и те же в полосе вкладок (ClientTabs.tsx)
// и в общем поиске (commandPalette/clientTabRows.ts). Слаги вкладок в адресе — clientTabRoute.ts.
import type { ClientTab } from './clientSheetTypes';

export const CLIENT_TAB_LABELS: [ClientTab, string][] = [
  ['overview', 'Обзор'],
  ['concept', 'Концептуализация'],
  ['plan', 'План работы'],
  ['mode_map', 'Графические карты'],
  ['sessions', 'Сессии'],
  ['tasks', 'Задания'],
  ['ysq', 'Схемы'],
  ['client_notes', 'Записи клиента'],
];
