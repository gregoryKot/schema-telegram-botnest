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

// Дневник: список, запись по id («Мой путь») и страницы «Записей» (R6).
function diaryRules(kind: 'schema' | 'mode' | 'gratitude'): Rule[] {
  const all = [
    { prefix: `/api/diary/${kind}` },
    { prefix: `/api/diary/page/${kind}` },
  ];
  const write = new RegExp(`^/api/diary/${kind}$`);
  const del = new RegExp(`^/api/diary/${kind}/\\d+$`);
  return [simple('POST', write, ...all), simple('DELETE', del, ...all)];
}

const SLOTS = { prefix: '/api/booking/slots' };
const CLIENT_BOOKING = '/api/client-booking';

export const RULES: Rule[] = [
  { method: 'DELETE', pattern: /^\/api\/user$/, clearAll: true },

  simple('POST', /^\/api\/disclaimer$/, '/api/disclaimer'),
  simple('POST', /^\/api\/ysq-progress$/, '/api/ysq-progress'),
  simple('DELETE', /^\/api\/ysq-progress$/, '/api/ysq-progress'),
  simple('POST', /^\/api\/settings$/, '/api/settings'),
  simple('POST', /^\/api\/push\/(subscription|unsubscribe)$/, '/api/settings'), // notifyChannel: push ↔ telegram
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
  // Чек-ин меняет и сам шаг: «Мой путь» открывает его по id (GET /api/plan/:id).
  {
    method: 'POST',
    pattern: /^\/api\/plan\/(\d+)\/checkin$/,
    targets: (m) => [
      '/api/plan/pending',
      `/api/plan/${m[1]}`,
      { prefix: '/api/plans/history' },
    ],
  },
  // GET /api/pair отдаёт pendingCode — созданное приглашение обязано быть
  // видно сразу, иначе экран пары ещё 15 секунд показывает «приглашения нет».
  simple('POST', /^\/api\/pair\/invite$/, '/api/pair'),
  simple('POST', /^\/api\/pair\/join$/, '/api/pair'),
  simple('DELETE', /^\/api\/pair$/, '/api/pair'),
  simple('POST', /^\/api\/childhood-ratings$/, '/api/childhood-ratings'),
  // saveYsqResult пишет ysqResult и ysqResultHistory: их читают история,
  // «Мой путь» (journey.service.ts) и профиль (profile.service.ts, ysq.*) —
  // по профилю «Мои паттерны» рисуют выраженные схемы (QA 2026-11, B-З5).
  // Та же транзакция закрывает задание терапевта «пройти тест» (К1) —
  // список заданий тоже.
  simple(
    'POST',
    /^\/api\/ysq-result$/,
    '/api/ysq-result',
    '/api/ysq-history',
    '/api/journey',
    '/api/profile',
    '/api/therapy/tasks',
    '/api/therapy/tasks/history',
  ),
  // «Удалить результаты теста» стирает итог, историю и прогресс; «Мой путь»
  // (journey.service.ts) и профиль (profile.service.ts, ysq.*) читают их же.
  simple(
    'DELETE',
    /^\/api\/ysq-data$/,
    '/api/ysq-result',
    { prefix: '/api/ysq-history' }, // и попытки по id («Мой путь»)
    '/api/ysq-progress',
    '/api/journey',
    '/api/profile',
  ),
  simple('POST', /^\/api\/profile\/name$/, '/api/profile'),
  ...diaryRules('schema'),
  ...diaryRules('mode'),
  ...diaryRules('gratitude'),
  simple('POST', /^\/api\/schema-notes$/, '/api/schema-notes'),
  simple('POST', /^\/api\/mode-notes$/, '/api/mode-notes'),
  // Быстрые практики «Здесь и сейчас» (мини-апп).
  simple('POST', /^\/api\/practice-session$/, '/api/practice-sessions'),
  // Дневниковые инструменты (webapp/src/api.ts).
  // Префикс — список и запись по id («Мой путь», R6) разом; письмо правится.
  simple('POST', /^\/api\/belief-checks$/, { prefix: '/api/belief-checks' }),
  simple('DELETE', /^\/api\/belief-checks\/\d+$/, {
    prefix: '/api/belief-checks',
  }),
  simple('POST', /^\/api\/letters$/, { prefix: '/api/letters' }),
  simple('PATCH', /^\/api\/letters\/\d+$/, { prefix: '/api/letters' }),
  simple('DELETE', /^\/api\/letters\/\d+$/, { prefix: '/api/letters' }),
  simple('POST', /^\/api\/safe-place$/, '/api/safe-place'),
  simple('POST', /^\/api\/flashcards$/, { prefix: '/api/flashcards' }),
  simple('DELETE', /^\/api\/flashcards\/\d+$/, { prefix: '/api/flashcards' }),
  simple('POST', /^\/api\/phrase-checks$/, '/api/phrase-checks'),
  simple('DELETE', /^\/api\/phrase-checks\/\d+$/, '/api/phrase-checks'),
  simple('PATCH', /^\/api\/phrase-checks\/\d+$/, '/api/phrase-checks'),
  // Запись на слот и её отмена меняют свободное время (booking.controller.ts):
  // слоты — префиксом (в адресе пояс посетителя), свои брони клиента
  // терапевта — обзор /api/client-booking (client-booking.controller.ts).
  simple('POST', /^\/api\/booking\/book$/, SLOTS),
  simple('POST', /^\/api\/booking\/cancel\/[^/]+$/, SLOTS, CLIENT_BOOKING),
  simple('POST', /^\/api\/client-booking\/book$/, SLOTS, CLIENT_BOOKING),
  // Отмена подписки по ссылке: статус по тому же токену — заново, не из кеша.
  {
    method: 'POST',
    pattern: /^\/api\/subscription\/cancel\/([^/]+)$/,
    targets: (m) => [`/api/subscription/by-token/${m[1]}`],
  },
  ...THERAPY_RULES,
];
