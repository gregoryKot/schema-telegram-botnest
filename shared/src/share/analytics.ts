// Тип карточки для продуктового события share_card (правило №8). Общий для
// обоих фронтендов; бэк держит парный allow-list в
// src/analytics/analytics.constants.ts — при добавлении вида синхронь оба.
export type ShareCardKind =
  'weekly' | 'day' | 'achievement' | 'streak' | 'schema' | 'diary' | 'ysq';

export const SHARE_CARD_EVENT = 'share_card';
// Исход системного шэра: meta { kind, ok }. Позволяет мерить «получилось ли
// поделиться» (картинка vs текстовый фолбэк). Allow-list — analytics.constants.
export const SHARE_RESULT_EVENT = 'share_result';
