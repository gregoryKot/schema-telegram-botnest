// Явная карта «мутация → какие ключи GET-кеша сбросить» (apiCache.ts).
// Осознанно НЕ префикс-угадывание по URL мутации: каждая строка — решение
// про конкретный роут, обоснованное чтением контроллера/сервиса (см.
// комментарии там, где решение не очевидно из одного взгляда). Новый
// POST/PATCH/DELETE с собственным кешируемым GET — новая строка здесь, а не
// забытая инвалидация (иначе пользователь увидит свои старые данные после
// сохранения — правило CLAUDE.md против недостоверных данных).
//
// `{ prefix }` используется только там, где айдишник мутации (id записи) не
// содержит родительский ключ (needId/clientId) кешированного GET — тогда
// сбрасываются все варианты ресурса. Это тоже явное решение, а не догадка.
//
// Данные вынесены из apiCacheRules.ts (движок применения) — правило №10
// CLAUDE.md: гейт размера файла упёрся бы в потолок 300 строк на одном списке
// правил, движок держит только логику (по образцу gendered-forms-patterns.mjs).
// Ручки /api/therapy/* — в apiCacheRules.therapy.ts, кирпичи — в .kit.ts.
import { simple, str, type Rule } from './apiCacheRules.kit';
import { THERAPY_RULES } from './apiCacheRules.therapy';

export const RULES: Rule[] = [
  { method: 'DELETE', pattern: /^\/api\/user$/, clearAll: true },

  simple('POST', /^\/api\/disclaimer$/, '/api/disclaimer'),
  simple('POST', /^\/api\/ysq-progress$/, '/api/ysq-progress'),
  simple('DELETE', /^\/api\/ysq-progress$/, '/api/ysq-progress'),
  simple('POST', /^\/api\/settings$/, '/api/settings'),
  {
    method: 'POST',
    pattern: /^\/api\/note$/,
    targets: (_m, body) =>
      str(body?.date) ? [`/api/note?date=${str(body?.date)}`] : [],
  },
  // saveRating (tracker.controller.ts): апдейтит ratings дня, при закрытии
  // всех потребностей триггерит стрик/задачи-по-стрику; history/insights
  // читают эти же ratings посуточно — их query-параметры (?days=N) заранее
  // неизвестны, поэтому сбрасываем префиксом.
  simple(
    'POST',
    /^\/api\/rating$/,
    { prefix: '/api/ratings' },
    { prefix: '/api/history' },
    '/api/streak',
    '/api/achievements',
    '/api/insights',
    '/api/therapy/tasks',
  ),
  // recordActivity (tracker.controller.ts) двигает стрик/активные дни истории.
  simple('POST', /^\/api\/activity$/, '/api/streak', {
    prefix: '/api/history',
  }),
  {
    method: 'POST',
    pattern: /^\/api\/practices$/,
    targets: (_m, body) =>
      str(body?.needId) ? [`/api/practices?needId=${str(body?.needId)}`] : [],
  },
  // deletePractice(id) — needId неизвестен из одного id, сбрасываем ресурс целиком.
  simple('DELETE', /^\/api\/practices\/\d+$/, { prefix: '/api/practices?' }),
  simple('POST', /^\/api\/plan$/, '/api/plan/pending'),
  simple('POST', /^\/api\/plan\/\d+\/checkin$/, '/api/plan/pending', {
    prefix: '/api/plans/history',
  }),
  // GET /api/pair отдаёт pendingCode — созданное приглашение обязано быть
  // видно сразу, иначе экран пары ещё 15 секунд показывает «приглашения нет».
  simple('POST', /^\/api\/pair\/invite$/, '/api/pair'),
  simple('POST', /^\/api\/pair\/join$/, '/api/pair'),
  simple('DELETE', /^\/api\/pair$/, '/api/pair'),
  simple('POST', /^\/api\/childhood-ratings$/, '/api/childhood-ratings'),
  // saveYsqResult пишет ysqResultHistory (journey.service.ts фид) — история и
  // журей читают тот же результат.
  simple(
    'POST',
    /^\/api\/ysq-result$/,
    '/api/ysq-result',
    '/api/ysq-history',
    '/api/journey',
  ),
  simple('DELETE', /^\/api\/ysq-result$/, '/api/ysq-result'),
  // «Удалить результаты теста» стирает итог, историю и прогресс; «Мой путь»
  // (journey.service.ts) и профиль (profile.service.ts, ysq.*) читают их же.
  simple(
    'DELETE',
    /^\/api\/ysq-data$/,
    '/api/ysq-result',
    '/api/ysq-history',
    '/api/ysq-progress',
    '/api/journey',
    '/api/profile',
  ),
  simple('POST', /^\/api\/profile\/name$/, '/api/profile'),
  simple('POST', /^\/api\/diary\/schema$/, '/api/diary/schema'),
  simple('DELETE', /^\/api\/diary\/schema\/\d+$/, '/api/diary/schema'),
  simple('POST', /^\/api\/diary\/mode$/, '/api/diary/mode'),
  simple('DELETE', /^\/api\/diary\/mode\/\d+$/, '/api/diary/mode'),
  simple('POST', /^\/api\/diary\/gratitude$/, '/api/diary/gratitude'),
  simple('DELETE', /^\/api\/diary\/gratitude\/\d+$/, '/api/diary/gratitude'),
  simple('POST', /^\/api\/schema-notes$/, '/api/schema-notes'),
  simple('POST', /^\/api\/mode-notes$/, '/api/mode-notes'),
  // Быстрые практики «Здесь и сейчас» (мини-апп).
  simple('POST', /^\/api\/practice-session$/, '/api/practice-sessions'),
  // Дневниковые инструменты (apiExercises.ts, оба фронтенда).
  simple('POST', /^\/api\/belief-checks$/, '/api/belief-checks'),
  simple('DELETE', /^\/api\/belief-checks\/\d+$/, '/api/belief-checks'),
  simple('POST', /^\/api\/letters$/, '/api/letters'),
  simple('DELETE', /^\/api\/letters\/\d+$/, '/api/letters'),
  simple('POST', /^\/api\/safe-place$/, '/api/safe-place'),
  simple('POST', /^\/api\/flashcards$/, '/api/flashcards'),
  simple('DELETE', /^\/api\/flashcards\/\d+$/, '/api/flashcards'),
  simple('POST', /^\/api\/phrase-checks$/, '/api/phrase-checks'),
  simple('DELETE', /^\/api\/phrase-checks\/\d+$/, '/api/phrase-checks'),
  simple('PATCH', /^\/api\/phrase-checks\/\d+$/, '/api/phrase-checks'),
  ...THERAPY_RULES,
];
