// Профиль «горизонт роста» для замера планов запросов (EXPLAIN ANALYZE).
// Это ×10 не от сегодняшнего прода, а от цели запуска: планировщик выбирает
// между seq scan и индексом по размеру таблицы, и план на 600 строках ничего
// не говорит о плане на 2 миллионах. Отчёт и документация цитируют ЭТОТ
// объект, а не выдуманные цифры.
import * as A from '../../src/analytics/analytics.constants';
import * as C from '../../src/analytics/case-steps.constants';
import * as G from '../../src/analytics/game-events.constants';

// Диапазон синтетических userId. Выше любых живых id (Telegram, web-only),
// поэтому `id >= base` однозначно означает «наше» и чистится без риска.
export const PERF_ID_BASE = 900_000_000_000;

// Пометка анонимных событий: у них userId = NULL, FK-каскад их не снесёт, а
// отличить от чужих анонимных строк иначе нечем. Ни один запрос отчёта этот
// ключ не читает.
export const PERF_SEED_MARK = { seed: 'perf' } as const;

export const PERF_PROFILE = {
  users: 10_000,
  // createdAt пользователей размазан на год: окна 7/30 дней в /stats должны
  // быть срезом таблицы, а не всей таблицей.
  userSpreadDays: 365,
  // Рейтинги: у каждого своё число дней (степенной перекос — мало кто ведёт
  // трекер долго). Коэффициент подобран так, чтобы вышло ~1.5 млн строк.
  ratingDaysScale: 180,
  // События — 120 дней: окно 30 дней = ~25% таблицы, ради него всё и затеяно.
  analyticsEvents: 2_000_000,
  eventSpreadDays: 120,
  schemaDiary: 150_000,
  modeDiary: 150_000,
  gratitudeDiary: 150_000,
  userPractice: 200_000,
  // Колесо детства — 5 потребностей на человека, unique(userId, needId).
  childhoodRating: 50_000,
  ysqResult: 3_000,
  ysqProgress: 5_000,
  userFlashcard: 20_000,
  userBeliefCheck: 20_000,
  userPhraseCheck: 20_000,
  userLetter: 20_000,
  // Безопасное место — одна запись на человека (PK userId), 20 000 физически
  // невозможно при 10 000 пользователях.
  userSafePlace: 5_000,
  therapists: 200,
  clientsPerTherapist: 50,
  // Приглашения без клиента — чтобы индексу (therapistId, status) было что
  // отфильтровывать.
  pendingRelations: 500,
} as const;

// Реальные id из shared/src/schemaTherapy/content и phraseCheck/criteria.
const ids = (s: string) => s.split(' ');
export const SCHEMA_IDS = ids(
  'abandonment mistrust defectiveness failure dependence subjugation self_sacrifice unrelenting_standards punitiveness_self',
);
export const MODE_IDS = ids(
  'vulnerable_child angry_child compliant_surrenderer detached_protector overcontroller demanding_critic punitive_critic healthy_adult happy_child',
);
export const PHRASE_MARKS = ids(
  'goal notok person label fear never mistake absolute worth',
);
export const EMOTION_IDS = ids('fear anxiety sadness shame guilt anger');
// Повтор значения = перекос в его пользу; NULL — «ещё не выбирал».
export const DEFAULT_SECTIONS = ids(
  'today today today today help schemas schemas profile',
);
export const TIMEZONES = [
  ...Array<string>(14).fill('Europe/Moscow'),
  ...ids(
    'Asia/Yekaterinburg Asia/Novosibirsk Europe/Berlin Asia/Almaty Europe/Minsk America/New_York',
  ),
];

type Val = string | number | boolean;
export interface EventSpec {
  name: string;
  /** Относительный вес: доля строк = weight / сумма весов. */
  weight: number;
  /** Процент строк с userId = NULL (анонимные события сайта и игры). */
  anon?: number;
  /** Ключ meta → набор значений; повтор значения = перекос в его пользу. */
  meta?: Readonly<Record<string, readonly Val[]>>;
}

const YES = [true, true, true, true, true, true, true, true, true, false];
const FIELDS = [0, 1, 2, 3, 4, 5, 6, 7];
const ALINK = ['max', 'telegram', 'web'];
const QUIZ = ['drives', 'critic', 'voice', 'battery'];
const SRC = ['web', 'web', 'bot'];
const mode = { modeId: MODE_IDS };
const fromTo = { from: MODE_IDS, to: [...MODE_IDS].reverse() };
const gameFrom = { from: G.GAME_CTA_PLACES };
const chapter = { chapter: G.GAME_CHAPTERS };
const screenBlock = {
  screen: A.CUSTOMIZABLE_SCREENS,
  block: A.SCREEN_BLOCK_IDS,
};
const section = ids(
  'auth login today diary schemas practice profile help cabinet booking other',
);

// Перекос в пользу событий, которые читает /stats (все имена ниже — оттуда).
// Имена обязаны быть в ANALYTICS_EVENTS: seed.ts падает на устаревшем, а
// добавленное в allow-list и не описанное здесь событие получит минимальный вес.
// prettier-ignore
export const EVENT_SPECS: readonly EventSpec[] = [
  { name: 'onboarding_step', weight: 60, meta: { step: A.ONBOARDING_STEPS } },
  { name: 'share_card', weight: 40, meta: { kind: A.SHARE_CARD_KINDS } },
  { name: 'share_result', weight: 30, meta: { kind: A.SHARE_CARD_KINDS, ok: YES } },
  { name: 'crisis_card_shown', weight: 15, meta: { surface: A.CRISIS_SURFACES } },
  { name: 'crisis_hotline_tapped', weight: 3, meta: { surface: A.CRISIS_SURFACES } },
  { name: 'outbox_flush', weight: 10, meta: { count: [1, 1, 2, 3, 5, 8, 13, 40] } },
  { name: 'today_focus_change', weight: 30, meta: { practice: A.TODAY_FOCUS_PRACTICES } },
  { name: 'today_block_toggle', weight: 20, meta: { block: A.TODAY_BLOCKS, hidden: [true, false, true] } },
  { name: 'today_streak_toggle', weight: 5, meta: { hidden: [true, false] } },
  { name: 'today_customize_open', weight: 10, meta: { via: A.CUSTOMIZE_ENTRY_POINTS } },
  { name: 'home_screen_offer', weight: 20, anon: 25, meta: { action: A.HOME_SCREEN_ACTIONS, surface: A.HOME_SCREEN_SURFACES } },
  { name: 'journey_open', weight: 30 },
  { name: 'ysq_help_open', weight: 10 },
  { name: 'plus_open', weight: 60 },
  { name: 'plus_action', weight: 50, meta: { action: A.QUICK_ACTION_IDS } },
  { name: 'quick_action_toggle', weight: 10, meta: { action: A.QUICK_ACTION_IDS, hidden: [true, false], surface: A.QUICK_ACTION_SURFACES } },
  { name: 'quick_action_move', weight: 10, meta: { action: A.QUICK_ACTION_IDS, surface: A.QUICK_ACTION_SURFACES, dir: A.QUICK_ACTION_MOVE_DIRS } },
  { name: 'screen_customize_open', weight: 7, meta: { screen: A.CUSTOMIZABLE_SCREENS, via: A.CUSTOMIZE_ENTRY_POINTS } },
  { name: 'screen_block_toggle', weight: 10, meta: { ...screenBlock, hidden: [true, false] } },
  { name: 'screen_block_move', weight: 8, meta: { ...screenBlock, dir: A.QUICK_ACTION_MOVE_DIRS } },
  { name: 'web_banner_open', weight: 10, meta: { banner: A.WEB_BANNER_IDS } },
  { name: 'web_banner_dismiss', weight: 10, meta: { banner: A.WEB_BANNER_IDS } },
  { name: 'breath_start', weight: 30 },
  { name: 'stop_start', weight: 15 },
  { name: 'mode_card_saved', weight: 20, meta: { ...mode, filledFields: FIELDS } },
  { name: 'mode_entry_saved', weight: 30, meta: { filledFields: FIELDS, filledHealthy: [true, false, false] } },
  { name: 'mode_test_completed', weight: 10, meta: mode },
  { name: 'mode_chain_followup', weight: 6, meta: fromTo },
  { name: 'mode_doubt_opened', weight: 6, meta: mode },
  { name: 'mode_doubt_switched', weight: 3, meta: fromTo },
  { name: 'warm_words_open', weight: 20, meta: { count: [0, 1, 3, 5, 12, 40] } },
  { name: 'profile_pattern_open', weight: 30, meta: { kind: A.PROFILE_PATTERN_KINDS } },
  { name: 'account_link_started', weight: 2, meta: { host: ALINK } },
  { name: 'account_link_confirmed', weight: 1.5, meta: { host: ALINK, merged: [true, true, false] } },
  { name: 'account_link_failed', weight: 0.5, meta: { host: ALINK, reason: ['expired', 'error'] } },
  { name: 'case_started', weight: 10 },
  { name: 'case_scene', weight: 10, meta: { source: C.CASE_SCENE_SOURCES } },
  { name: 'case_criterion', weight: 20, meta: { verdict: C.CASE_VERDICTS } },
  { name: 'case_recognized', weight: 10, meta: { ...mode, agreed: YES } },
  { name: 'mode_renamed', weight: 5, meta: { source: C.MODE_RENAME_SOURCES } },
  { name: 'case_finished', weight: 8, meta: mode },
  { name: 'entry_deleted', weight: 2, meta: { type: A.ENTRY_DELETE_TYPES } },
  { name: 'data_export', weight: 1, meta: { tables: [40, 41, 42], rows: [120, 900, 15000] } },
  { name: 'signup_source', weight: 5, meta: { src: A.SIGNUP_SOURCES } },
  { name: 'desktop_app_open', weight: 5 },
  // Анонимные: сайт, игра и серверные события (пишет бэкенд без userId).
  { name: 'quiz_started', weight: 30, anon: 60, meta: { quiz: QUIZ, src: SRC } },
  { name: 'quiz_completed', weight: 20, anon: 60, meta: { quiz: QUIZ, result: ['a', 'b', 'c'], src: SRC } },
  { name: 'practice_link_click', weight: 20, anon: 100, meta: { place: A.PRACTICE_LINK_PLACES } },
  { name: 'login_ticket_step', weight: 10, anon: 100, meta: { step: A.LOGIN_TICKET_STEPS, host: A.LOGIN_TICKET_HOSTS } },
  { name: 'game_open', weight: 20, anon: 100, meta: { src: G.GAME_ENTRY_SOURCES } },
  { name: 'game_start', weight: 10, anon: 100 },
  { name: 'game_tutorial_done', weight: 6, anon: 100 },
  { name: 'game_tutorial_skip', weight: 4, anon: 100 },
  { name: 'game_chapter_start', weight: 10, anon: 100, meta: chapter },
  { name: 'game_chapter_done', weight: 6, anon: 100, meta: chapter },
  { name: 'game_cta_shown', weight: 5, anon: 100, meta: gameFrom },
  { name: 'game_cta_click', weight: 2, anon: 100, meta: gameFrom },
  { name: 'game_share', weight: 2, anon: 100, meta: gameFrom },
  { name: 'game_over', weight: 3, anon: 100, meta: chapter },
  { name: 'auth_success', weight: 45, anon: 100, meta: { host: ['telegram', 'telegram', 'telegram', 'max', 'web'] } },
  { name: 'auth_rejected', weight: 3, anon: 100, meta: { host: ['telegram', 'max'] } },
  { name: 'client_error', weight: 8, anon: 100, meta: { section, source: ['webapp', 'miniapp'] } },
];

/**
 * EVENT_SPECS, сверенные с allow-list: устаревшее имя — ошибка (отчёт мерил
 * бы событие, которого нет), новое необъявленное получает минимальный вес.
 * rows — сколько строк достаётся событию из PERF_PROFILE.analyticsEvents.
 */
export function eventPlan(): Array<EventSpec & { rows: number }> {
  const known = new Set<string>(A.ANALYTICS_EVENTS);
  const stale = EVENT_SPECS.filter((s) => !known.has(s.name));
  if (stale.length) {
    const names = stale.map((s) => s.name).join(', ');
    throw new Error(
      `seed-profile.ts: ${names} нет в ANALYTICS_EVENTS, обнови EVENT_SPECS`,
    );
  }
  const described = new Set(EVENT_SPECS.map((s) => s.name));
  const tail = A.ANALYTICS_EVENTS.filter((n) => !described.has(n));
  const specs: EventSpec[] = [
    ...EVENT_SPECS,
    ...tail.map((name) => ({ name, weight: 0.5 })),
  ];
  const sum = specs.reduce((acc, s) => acc + s.weight, 0);
  const total = PERF_PROFILE.analyticsEvents;
  return specs.map((s) => ({
    ...s,
    rows: Math.round((total * s.weight) / sum),
  }));
}
