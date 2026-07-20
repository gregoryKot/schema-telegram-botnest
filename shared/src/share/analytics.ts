// Тип карточки для продуктового события share_card (правило №8). Общий для
// обоих фронтендов; бэк держит парный allow-list в
// src/analytics/analytics.constants.ts — при добавлении вида синхронь оба.
export type ShareCardKind =
  | 'weekly'
  | 'day'
  | 'achievement'
  | 'streak'
  | 'schema'
  | 'diary'
  | 'ysq'
  | 'mode'
  | 'pair_invite'
  | 'month'
  | 'achievements'
  | 'phrase'
  | 'gratitude';

export const SHARE_CARD_EVENT = 'share_card';
// Исход системного шэра: meta { kind, ok }. Позволяет мерить «получилось ли
// поделиться» (картинка vs текстовый фолбэк). Allow-list — analytics.constants.
export const SHARE_RESULT_EVENT = 'share_result';

// Шаг обучающего онбординга: meta { step }. По нему в /stats строится воронка
// «докуда доходят новички». Парный allow-list (ONBOARDING_STEPS) —
// src/analytics/analytics.constants.ts, при добавлении шага синхронь оба.
export const ONBOARDING_STEP_EVENT = 'onboarding_step';
export type OnboardingStep =
  | 'welcome'
  | 'privacy'
  | 'not_therapy'
  | 'needs_what'
  | 'needs_why'
  | 'needs_result'
  | 'today_screen'
  | 'author'
  | 'home_screen'
  | 'done';
