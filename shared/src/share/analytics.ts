// Тип карточки для продуктового события share_card (правило №8). Общий для
// обоих фронтендов; бэк держит парный allow-list в
// src/analytics/analytics.constants.ts — при добавлении вида синхронь оба.
export type ShareCardKind =
  | 'weekly'
  | 'achievement'
  | 'streak'
  | 'schema'
  | 'diary';

export const SHARE_CARD_EVENT = 'share_card';
