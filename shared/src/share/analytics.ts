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
  | 'app_invite'
  | 'therapist_invite'
  | 'month'
  | 'achievements'
  | 'phrase'
  | 'gratitude'
  | 'journey'
  | 'journey_item'
  | 'practice'
  | 'mode_entry_full'
  | 'phrase_check'
  | 'phrase_check_full';

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

// Сохранение записи дневника режимов: meta { filledFields 0..7, filledHealthy }.
// Парный allow-list (ANALYTICS_EVENTS) — src/analytics/analytics.constants.ts.
export const MODE_ENTRY_SAVED_EVENT = 'mode_entry_saved';
// Тест «по функции» определил режим: meta { modeId }. Парный allow-list там же.
export const MODE_TEST_COMPLETED_EVENT = 'mode_test_completed';

// Открытие раздела «Тёплые слова»: meta { count } — сколько записей в
// коллекции (0..1000). Парный allow-list — src/analytics/analytics.constants.ts.
export const WARM_WORDS_OPEN_EVENT = 'warm_words_open';
// Согласился разобрать связанный режим после записи дневника режимов:
// meta { from, to } — modeId исходного и выбранного режима. Парный allow-list
// там же.
export const MODE_CHAIN_FOLLOWUP_EVENT = 'mode_chain_followup';

// Открыл лист «С чем путают режим» (сравнение с соседями по путанице) с
// карточки выбранного режима: meta { modeId }. Парный allow-list там же.
export const MODE_DOUBT_OPENED_EVENT = 'mode_doubt_opened';
// В листе «С чем путают режим» нажал «Это ближе» — переключил выбор:
// meta { from, to } — modeId исходного и выбранного режима. Парный allow-list там же.
export const MODE_DOUBT_SWITCHED_EVENT = 'mode_doubt_switched';

/** meta для mode_entry_saved из значений формы дневника (общий, оба фронта). */
export function modeEntrySavedMeta(
  fieldValues: string[], // 7 текстовых полей дневника (любой порядок)
  healthyResponse: string,
): { filledFields: number; filledHealthy: boolean } {
  return {
    filledFields: fieldValues.filter((v) => v.trim().length > 0).length,
    filledHealthy: healthyResponse.trim().length > 0,
  };
}

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

// ── Перенос аккаунта из мессенджера (device-link, RFC 8628) ─────────────────
// Путь идёт через внешний браузер, поэтому мерить надо все три точки: начал в
// мессенджере, подтвердил в браузере, не вышло. Без последней в отчёте видны
// только успехи, и «сколько людей не смогли» не измерить.
// Парный allow-list (ANALYTICS_EVENTS, ACCOUNT_LINK_*) —
// src/analytics/analytics.constants.ts, при изменении синхронь оба.
export const ACCOUNT_LINK_STARTED_EVENT = 'account_link_started';
export const ACCOUNT_LINK_CONFIRMED_EVENT = 'account_link_confirmed';
export const ACCOUNT_LINK_FAILED_EVENT = 'account_link_failed';

/** Мессенджер, из которого переносят: meta.host. */
export type AccountLinkHost = 'max' | 'telegram';
/** Почему не вышло: meta.reason. */
export type AccountLinkFailReason = 'expired' | 'error';

// Открытие листа схемы/режима с редизайна вкладки «Я»: meta { kind }.
// Парный allow-list (ANALYTICS_EVENTS, PROFILE_PATTERN_KINDS) —
// src/analytics/analytics.constants.ts. Фронт вкладки «Я» ещё не подключён
// (см. src/security/analytics-sync.invariants.spec.ts, BACKEND_ONLY) — тот
// же приём, что у MODE_CARD_SAVED_EVENT: контракт заводится раньше UI.
export const PROFILE_PATTERN_OPEN_EVENT = 'profile_pattern_open';
export type ProfilePatternKind = 'schema' | 'mode';

// ── Разбор случая («Что это было») ─────────────────────────────────────────
// Новая точка входа: человек за три минуты разбирает один случай и получает
// первую запись дневника, приметы для карточки и метку на карте себя.
// Имена событий шлются строковыми литералами из компонентов потока — так их
// видит спека синхронизации (src/security/analytics-sync.invariants.spec.ts);
// здесь живут типы меты. Парный allow-list и санитайзер —
// src/analytics/case-steps.constants.ts и src/api/analytics-meta.sanitize-case.ts.
//
// Свободного текста в мете нет по построению: сцена, имя режима и «своё…»
// остаются на клиенте и в зашифрованных полях карточки (правило №7).

/** Вердикт критерия Jacob: meta.verdict у case_criterion. */
export type CaseVerdictMeta = 'mode' | 'ordinary' | 'borderline';

/** Откуда взялась сцена: meta.source у case_scene. */
export type CaseSceneSource = 'own' | 'frame';

/**
 * Откуда взялось имя режима: meta.source у mode_renamed. Доля `own` и `chip`
 * против `skipped` показывает, присваивает ли человек часть себе, — ради
 * этого шаг и существует.
 */
export type ModeRenameSource = 'chip' | 'own' | 'skipped';
