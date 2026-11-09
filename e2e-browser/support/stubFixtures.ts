// Ответы бэкенда для браузерного смока (support/stubApi.ts). Правило одно:
// фикстура — то, что настоящий контроллер из src/ отдаёт клиенту без данных,
// той же формы (откуда взято — у каждой строки). Отступления намеренные и
// оговорены у строки: согласие уже дано, форма обращения выбрана — иначе
// оверлеи первого входа перекрывают сценарии смока. Выдуманная форма врёт в
// обе стороны: `{}` вместо массива на /api/history ронял «Сегодня» в «Раздел
// упал», которого в проде нет (ci-alarm #903), а /articles под `{}` рисовал
// экран падения, и a11y-смок проверял доступность его, а не списка статей.
// Каждую ручку сверяет с настоящим сервером test/browser-stub-contract.e2e-spec.ts
// (статус и тело; живая база, CI-джоба `migrations`): разъехавшаяся фикстура
// краснит PR, а не ночной смок.
import { ARTICLE_DIAGRAM_KEYS } from '../../src/articles/article-diagrams';
import { ARTICLE_SEED } from '../../src/articles/articles.seed';
import { SCREEN_FIXTURES } from './stubScreens';

/** GET /api/needs — список BotService.needs (src/bot/bot.service.ts). */
export const STUB_NEEDS = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: '🤝 Привязанность',
    fullTitle:
      'Безопасная привязанность\n(безопасность, стабильность, забота, принятие)',
    chartLabel: 'Привязанность',
  },
  {
    id: 'autonomy',
    emoji: '🚀',
    title: '🚀 Автономия',
    fullTitle: 'Автономия, компетентность и чувство идентичности',
    chartLabel: 'Автономия',
  },
  {
    id: 'expression',
    emoji: '💬',
    title: '💬 Выражение чувств',
    fullTitle: 'Свобода выражать потребности и эмоции',
    chartLabel: 'Выражение чувств',
  },
  {
    id: 'play',
    emoji: '🎉',
    title: '🎉 Спонтанность',
    fullTitle: 'Спонтанность и игра',
    chartLabel: 'Спонтанность',
  },
  {
    id: 'limits',
    emoji: '⚖️',
    title: '⚖️ Границы',
    fullTitle: 'Реалистичные границы и самоконтроль',
    chartLabel: 'Границы',
  },
];

// GET /api/profile — полная форма UserProfile (shared/src/types.ts), не
// урезанная: TodaySection читает `profile.ysq.activeSchemaIds` без `?.` на
// вложенном поле, и `{role:'CLIENT'}` ронял экран (поймано этим смоком).
const PROFILE = {
  name: null,
  role: 'CLIENT',
  ysq: { completedAt: null, activeSchemaIds: [] },
  notifications: {
    enabled: true,
    reminderEnabled: true,
    timezone: 'Europe/Moscow',
    localHour: 21,
  },
  streak: 0,
  lastActivity: {
    needsTracker: null,
    schemaDiary: null,
    modeDiary: null,
    gratitudeDiary: null,
  },
  mySchemaIds: [],
  myModeIds: [],
  unreadableLists: [],
};

// GET /api/settings — умолчания src/api/settings.controller.ts, кроме addressForm:
// при null AddressFormPicker («Как удобнее общаться?») кладёт fixed-оверлей поверх
// приложения и перехватывает клики сценариев (выбор формы — AddressFormPicker.test.tsx).
const SETTINGS = {
  notifyEnabled: true,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: true,
  notifySummaryEnabled: true,
  notifyFrequency: 0,
  notifyQuietStart: 22,
  notifyQuietEnd: 8,
  notifyGamified: false,
  notifyPausedUntil: null,
  addressForm: 'ty',
  pairCardDismissed: false,
  mySchemaIds: [],
  myModeIds: [],
  therapistShareCards: true,
  therapistShareProfile: true,
  uiPrefs: {},
  notifyReachable: false,
  // Куда уходят уведомления (src/bot/notify-channel.ts): у нового аккаунта
  // без Telegram и без подписки в приложении — никуда.
  notifyChannel: null,
  telegramLinked: false,
};

// GET /api/user-flags (src/api/api.controller.ts) — поля FLAG_FIELDS
// (src/api/flag-fields.ts) и therapistMode со значениями по умолчанию модели
// User (prisma/schema.prisma). Сайт из них читает только therapistMode.
const NEW_USER_FLAGS = {
  themePref: null,
  onboardingV1Done: false,
  onboardingV2Done: false,
  onboardingSkipped: [],
  childhoodWheelDone: false,
  ysqBannerDismissed: false,
  hintSheetCloseShown: false,
  hintHistoryDismissed: false,
  trackerOnboardingDone: false,
  lastCelebrationDate: null,
  lastYesterdayBannerDate: null,
  lastWeeklyQuestionWeek: null,
  schemaIntrosShown: [],
  modeIntrosShown: [],
  defaultSection: null,
  therapistMode: false,
};

// GET /api/articles — ArticlesService.list() после сида
// (src/articles/articles.service.ts): поля без content, свежие первыми.
const ARTICLES = ARTICLE_SEED.map((a, i) => ({
  id: i + 1,
  slug: a.slug,
  title: a.title,
  description: a.description,
  date: `${a.date}T00:00:00.000Z`,
  updatedAt: `${a.date}T00:00:00.000Z`,
  readMin: a.readMin,
  diagramKey: ARTICLE_DIAGRAM_KEYS[a.slug] ?? null,
})).sort((x, y) => y.date.localeCompare(x.date));

/**
 * Неизменные ответы по «МЕТОД /путь» (без query). `null` — пустое тело со
 * статусом 200: так Nest отвечает на `return null` (ExpressAdapter.reply →
 * response.send()), а клиент читает его как null
 * (shared/src/api/readJsonBody.ts). Статус — умолчание Nest (POST — 201,
 * остальное — 200), кроме ручек с `@HttpCode` из STATUS.
 */
export const FIXTURES: Record<string, unknown> = {
  ...SCREEN_FIXTURES, // «Профиль» и «Паттерны»: stubScreens.ts
  'GET /api/articles': ARTICLES,
  // auth.controller.ts me(): способов входа и 2FA у чистого веб-клиента нет («/account»)
  'GET /api/auth/me': {
    userId: '1',
    providers: [],
    totp: { enabled: false, recoveryCodesLeft: 0 },
  },
  'GET /api/belief-checks': [], // exercises.controller.ts
  'GET /api/childhood-ratings': {}, // BotService.getChildhoodRatings
  'GET /api/diary/gratitude': [], // diary.controller.ts
  'GET /api/diary/mode': [],
  'GET /api/diary/page/gratitude': { items: [], hasMore: false }, // «Записи»
  'GET /api/diary/page/mode': { items: [], hasMore: false },
  'GET /api/diary/page/schema': { items: [], hasMore: false },
  'GET /api/diary/schema': [],
  'GET /api/disclaimer': { accepted: true }, // согласие уже дано
  'GET /api/letters': [], // exercises.controller.ts
  'GET /api/mode-notes': [], // notes.controller.ts
  'GET /api/needs': STUB_NEEDS,
  'GET /api/phrase-checks': [], // phrase-check.controller.ts
  'GET /api/plan/pending': [], // plans.controller.ts
  'GET /api/plans/history': [],
  'GET /api/practice-sessions': { breathing: 0, grounding: 0, stop: 0 },
  'GET /api/practices': [], // plans.controller.ts
  'GET /api/profile': PROFILE,
  // push.controller.ts: без VAPID-ключей (как в e2e) включение не предлагается.
  'GET /api/push/config': { publicKey: null },
  'GET /api/safe-place': null, // ExercisesService.getSafePlace
  'GET /api/schema-notes': [], // notes.controller.ts
  'GET /api/settings': SETTINGS,
  'GET /api/streak': {
    // BotAnalyticsService → src/bot/bot.activity-streak.ts getStreakData
    currentStreak: 0,
    longestStreak: 0,
    totalDays: 0,
    todayDone: false,
    weekDots: [false, false, false, false, false, false, false],
  },
  'GET /api/therapy/relation': null, // связи с терапевтом нет
  'GET /api/therapy/request': null, // therapy-connection.controller.ts: заявки нет
  // src/api/pairs.controller.ts → PairsData (shared/src/apiTypes.ts): пар и приглашения нет.
  'GET /api/pair': { partners: [], pendingCode: null, pendingUrl: null },
  'GET /api/therapy/tasks': [], // therapy-tasks.controller.ts
  'GET /api/therapy/tasks/history': [],
  'GET /api/user-flags': NEW_USER_FLAGS,
  'GET /api/ysq-progress': null, // YsqService
  'GET /api/ysq-result': null,
  'POST /api/activity': { ok: true }, // tracker.controller.ts
  'POST /api/auth/refresh': { accessToken: 'e2e-test-token', expiresIn: 900 },
  'POST /api/event': { ok: true }, // analytics.controller.ts
  'POST /api/public-event': { ok: true }, // public-events.controller.ts (asset-recovery.js)
  'POST /api/init': { ok: true }, // api.controller.ts
  'POST /api/settings': { ok: true }, // settings.controller.ts
};

/** Ручки с `@HttpCode`, у которых статус не умолчание Nest. */
export const STATUS: Record<string, number> = {
  'POST /api/auth/refresh': 200, // src/auth/auth.controller.ts
};
