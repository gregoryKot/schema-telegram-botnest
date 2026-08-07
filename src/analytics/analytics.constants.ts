// Реестр продуктовых событий (правило №8 CLAUDE.md). Источник правды для
// бэка: DTO валидирует name/kind по этим allow-list'ам, сервис пишет только
// известные события. Фронтовые вызовы api.trackEvent должны слать те же имена
// (парный список в схожем виде на фронтах — при добавлении события синхронь).
//
// meta — маленький СТРУКТУРНЫЙ non-PII объект. НИКОГДА не класть свободный
// текст пользователя (он не шифруется, см. комментарий модели AnalyticsEvent).

// Разрешённые имена событий.
//   share_card          — нажал «Поделиться» на карточке (meta.kind);
//   share_result        — исход системного шэра (meta.kind + meta.ok);
//   crisis_card_shown   — показалась карточка помощи (meta.surface);
//   crisis_hotline_tapped — нажал на телефон доверия (meta.surface);
//   outbox_flush        — доехали записи, сделанные без интернета (meta.count);
//   today_focus_change  — сменил главную практику экрана «Сегодня» (meta.practice);
//   today_streak_toggle — скрыл/показал счётчик серии (meta.hidden);
//   breath_start        — запустил дыхание «Здесь и сейчас» (без meta);
//   stop_start          — запустил технику «Стоп» в «Здесь и сейчас» (без meta);
//   web_banner_open     — открыл сайт из баннера кабинета (meta.banner);
//   web_banner_dismiss  — скрыл баннер кабинета (meta.banner);
//   onboarding_step     — новичок дошёл до шага обучения (meta.step);
//   today_block_toggle  — показал/скрыл блок «Сегодня» (meta.block + meta.hidden);
//   today_customize_open — открыл «Настроить экран» (meta.via: как открыл);
//   home_screen_offer   — предложение значка на экран (meta.action + surface);
//   journey_open        — открыл архив «Мой путь» (без meta);
//   ysq_help_open       — раскрыл «Как понимать» в результатах теста схем
//                         (без meta);
//   quiz_started        — начал мини-тест (meta.quiz + meta.src);
//   quiz_completed      — дошёл до результата мини-теста (meta.quiz +
//                         meta.result + meta.src). С сайта идут анонимно
//                         (userId = null) через POST /api/public-event.
//   practice_link_click — кликнул ссылку на сайт практики автора с
//                         продуктового лендинга (meta.place). Всегда анонимно
//                         (userId = null) через POST /api/public-event.
//   mode_card_saved     — сохранил заполненную карточку режима
//                         (meta.modeId + meta.filledFields, 0..7).
//   mode_entry_saved    — сохранил запись в дневнике режимов
//                         (meta.filledFields 0..7 + meta.filledHealthy).
//   mode_test_completed — определил режим тестом «по функции» (meta.modeId).
//   warm_words_open     — открыл раздел «Тёплые слова» (meta.count — сколько
//                         записей в коллекции, 0..1000).
//   mode_chain_followup — после сохранения записи дневника режимов согласился
//                         разобрать связанный режим (meta.from + meta.to —
//                         modeId исходного и выбранного режима).
//   mode_doubt_opened   — открыл «С чем путают режим» с карточки выбранного
//                         режима (meta.modeId).
//   mode_doubt_switched — в «С чем путают режим» нажал «Это ближе» (meta.from
//                         + meta.to — modeId исходного и выбранного режима).
//   account_link_started — из мессенджера начал перенос данных со своего
//                         прежнего аккаунта (meta.host: max|telegram);
//   account_link_confirmed — подтвердил перенос в браузере (meta.host +
//                         meta.merged — реально ли что-то переехало);
//   account_link_failed — перенос не состоялся (meta.host + meta.reason:
//                         expired|error). Без него в отчёте видно только
//                         успехи, и «сколько людей не смогли» не измерить.
//   plus_open           — открыл универсальное меню «плюс» (без meta).
//   plus_action         — выбрал действие в меню «плюс» (meta.action —
//                         QuickActionId).
//   quick_action_toggle — скрыл/вернул пункт в настройке меню (meta.action +
//                         meta.hidden + meta.surface: 'plus'|'tools').
//   quick_action_move   — переставил пункт в настройке меню (meta.action +
//                         meta.surface + meta.dir: 'up'|'down').
//   screen_customize_open — открыл «Настроить экран» на «Профиле»/«Паттернах»
//                         (meta.screen + meta.via — переиспользует
//                         CUSTOMIZE_ENTRY_POINTS).
//   screen_block_toggle — показал/скрыл блок на «Профиле»/«Паттернах»
//                         (meta.screen + meta.block + meta.hidden).
export const ANALYTICS_EVENTS = [
  'share_card',
  'share_result',
  'crisis_card_shown',
  'crisis_hotline_tapped',
  'outbox_flush',
  'today_focus_change',
  'today_streak_toggle',
  'breath_start',
  'stop_start',
  'web_banner_open',
  'web_banner_dismiss',
  'onboarding_step',
  'today_block_toggle',
  'today_customize_open',
  'home_screen_offer',
  'journey_open',
  'ysq_help_open',
  'quiz_started',
  'quiz_completed',
  'practice_link_click',
  'mode_card_saved',
  'mode_entry_saved',
  'mode_test_completed',
  'warm_words_open',
  'mode_chain_followup',
  'mode_doubt_opened',
  'mode_doubt_switched',
  'account_link_started',
  'account_link_confirmed',
  'account_link_failed',
  'plus_open',
  'plus_action',
  'quick_action_toggle',
  'quick_action_move',
  'screen_customize_open',
  'screen_block_toggle',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

// События, которые разрешено слать БЕЗ авторизации (POST /api/public-event):
// мини-тесты «без регистрации» и клики лендинга. Только этот срез —
// остальная аналитика по-прежнему требует верифицированной идентичности.
export const PUBLIC_ANALYTICS_EVENTS = [
  'quiz_started',
  'quiz_completed',
  'practice_link_click',
] as const;
export type PublicAnalyticsEventName = (typeof PUBLIC_ANALYTICS_EVENTS)[number];

// Откуда пришло событие мини-теста (meta.src): бот или сайт. Сайт пишет
// 'web' на сервере (клиенту не верим), бот — 'bot' сам.
export const QUIZ_EVENT_SOURCES = ['bot', 'web'] as const;
export type QuizEventSource = (typeof QUIZ_EVENT_SOURCES)[number];

// Откуда кликнули по ссылке на сайт практики автора (meta.place для
// practice_link_click): блок «Кто это делает», подвал лендинга, ответ FAQ,
// экран результата мини-теста. Парная константа на фронте —
// shared/src/share/analytics.ts (синхронно).
export const PRACTICE_LINK_PLACES = [
  'author',
  'footer',
  'faq',
  'quiz',
  'ysq_result', // CTA в результатах теста схем (оба фронтенда)
] as const;
export type PracticeLinkPlace = (typeof PRACTICE_LINK_PLACES)[number];

// Блоки главного экрана, которые можно скрыть (meta.block). Заменяет частное
// событие today_streak_toggle: блоков стало больше одного, и заводить событие
// на каждый — плодить реестры. Старое имя остаётся в allow-list ради уже
// накопленных строк, /stats суммирует оба.
export const TODAY_BLOCKS = [
  'streak',
  'phrase',
  'secondary',
  'therapist_banner',
] as const;
export type TodayBlock = (typeof TODAY_BLOCKS)[number];

// Как открыли «Настроить экран»: шестерёнка в шапке или долгое нажатие на
// блок. Нужно, чтобы понять, находят ли жест вообще (он без аффорданса).
export const CUSTOMIZE_ENTRY_POINTS = ['gear', 'longpress'] as const;
export type CustomizeEntryPoint = (typeof CUSTOMIZE_ENTRY_POINTS)[number];

// Что произошло с предложением «добавить значок на экран» (meta.action) и где
// оно показывалось (meta.surface). 'added' приходит событием от Telegram —
// это единственный достоверный признак, что значок реально появился.
export const HOME_SCREEN_ACTIONS = [
  'shown',
  'add',
  'later',
  'never',
  'added',
] as const;
export type HomeScreenAction = (typeof HOME_SCREEN_ACTIONS)[number];

// Откуда переносят данные (meta.host) и почему не вышло (meta.reason) для
// событий account_link_*. Парная константа на фронтах —
// shared/src/share/analytics.ts (синхронно).
export const ACCOUNT_LINK_HOSTS = ['max', 'telegram'] as const;
export type AccountLinkHost = (typeof ACCOUNT_LINK_HOSTS)[number];

export const ACCOUNT_LINK_FAIL_REASONS = ['expired', 'error'] as const;
export type AccountLinkFailReason = (typeof ACCOUNT_LINK_FAIL_REASONS)[number];

export const HOME_SCREEN_SURFACES = [
  'onboarding',
  'today',
  'settings',
] as const;
export type HomeScreenSurface = (typeof HOME_SCREEN_SURFACES)[number];

// Шаги обучающего онбординга мини-аппа (meta.step для onboarding_step).
// Порядок = порядок показа: по нему строится воронка «докуда доходят».
// 'done' — нажал финальную кнопку. Парный список на фронте:
// shared/src/share/analytics.ts (при добавлении шага синхронь оба).
export const ONBOARDING_STEPS = [
  'welcome',
  'privacy',
  'not_therapy',
  'needs_what',
  'needs_why',
  'needs_result',
  'diaries_why',
  'today_screen',
  'author',
  'home_screen',
  'done',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// Тип карточки для событий share_card / share_result (meta.kind).
export const SHARE_CARD_KINDS = [
  'weekly',
  'day',
  'achievement',
  'streak',
  'schema',
  'diary',
  'ysq',
  'mode',
  'mode_entry',
  'pair_invite',
  'app_invite',
  'therapist_invite',
  'month',
  'achievements',
  'phrase',
  'gratitude',
  'journey',
  'journey_item',
  'practice',
  'mode_entry_full',
  'phrase_check',
  'phrase_check_full',
] as const;
export type ShareCardKind = (typeof SHARE_CARD_KINDS)[number];

// CRISIS_SURFACES/CrisisSurface — вынесены в crisis-surfaces.constants.ts
// (правило №10: файл держим ≤201 строки).
export {
  CRISIS_SURFACES,
  type CrisisSurface,
} from './crisis-surfaces.constants';

// Главная практика экрана «Сегодня» (meta.practice для today_focus_change) —
// парно с FocusPractice на фронте (schema-miniapp/src/utils/todayFocus.ts).
export const TODAY_FOCUS_PRACTICES = [
  'tracker',
  'schema',
  'mode',
  'gratitude',
] as const;
export type TodayFocusPractice = (typeof TODAY_FOCUS_PRACTICES)[number];

// Идентификаторы баннеров «полная версия на сайте» (meta.banner для событий
// web_banner_open / web_banner_dismiss). Парный список — на фронте мини-аппа
// (schema-miniapp/src/utils/webBanner.ts), при добавлении баннера синхронь.
export const WEB_BANNER_IDS = ['cabinet_full', 'mode_map'] as const;
export type WebBannerId = (typeof WEB_BANNER_IDS)[number];

// QUICK_ACTION_IDS/QuickActionId/QUICK_ACTION_SURFACES/QuickActionSurface —
// вынесены в quick-actions.constants.ts (правило №10: тот файл держим
// минимальным, парность с фронтом описана прямо там).
export {
  QUICK_ACTION_IDS,
  type QuickActionId,
  QUICK_ACTION_SURFACES,
  type QuickActionSurface,
  QUICK_ACTION_MOVE_DIRS,
  type QuickActionMoveDir,
} from './quick-actions.constants';

// SCREEN_BLOCK_IDS/ScreenBlockId/CUSTOMIZABLE_SCREENS/CustomizableScreen —
// вынесены в screen-blocks.constants.ts (правило №10, тот же приём, что и
// с QUICK_ACTION_IDS выше).
export {
  SCREEN_BLOCK_IDS,
  type ScreenBlockId,
  CUSTOMIZABLE_SCREENS,
  type CustomizableScreen,
} from './screen-blocks.constants';
