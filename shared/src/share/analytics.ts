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
  | 'mode_entry'
  | 'pair_invite'
  | 'month'
  | 'achievements'
  | 'phrase'
  | 'gratitude'
  | 'journey'
  | 'journey_item'
  | 'practice';

export const SHARE_CARD_EVENT = 'share_card';
// Исход системного шэра: meta { kind, ok }. Позволяет мерить «получилось ли
// поделиться» (картинка vs текстовый фолбэк). Allow-list — analytics.constants.
export const SHARE_RESULT_EVENT = 'share_result';

// Шаг обучающего онбординга: meta { step }. По нему в /stats строится воронка
// «докуда доходят новички». Парный allow-list (ONBOARDING_STEPS) —
// src/analytics/analytics.constants.ts, при добавлении шага синхронь оба.
export const ONBOARDING_STEP_EVENT = 'onboarding_step';

// Открытие архива «Мой путь» (без meta). Парное имя — в ANALYTICS_EVENTS
// на бэке; метрика видна в /stats («Архив „Мой путь“»).
export const JOURNEY_OPEN_EVENT = 'journey_open';

// Клик по ссылке на сайт практики автора (kotlarewski.gr) с публичного сайта:
// meta { place } — блок об авторе / подвал / ответ FAQ / экран результата
// мини-теста. Страницы видят только гости, событие анонимное — через
// api.trackPublicEvent (userId = null). Парный allow-list
// (PRACTICE_LINK_PLACES) — src/analytics/analytics.constants.ts, при
// добавлении места синхронь оба.
export const PRACTICE_LINK_CLICK_EVENT = 'practice_link_click';
export type PracticeLinkPlace =
  'author' | 'footer' | 'faq' | 'quiz' | 'ysq_result';
// Сохранение карточки-портрета режима («Знакомство с режимом»): meta
// { modeId, filledFields } — сколько из 7 полей заполнено. Парный allow-list
// (ANALYTICS_EVENTS) — src/analytics/analytics.constants.ts (бэкенд, агент Б
// контракта mode-intro-card на момент написания ещё не подключил его сюда).
export const MODE_CARD_SAVED_EVENT = 'mode_card_saved';

export type OnboardingStep =
  | 'welcome'
  | 'privacy'
  | 'not_therapy'
  | 'needs_what'
  | 'needs_why'
  | 'needs_result'
  | 'diaries_why'
  | 'today_screen'
  | 'author'
  | 'home_screen'
  | 'done';
