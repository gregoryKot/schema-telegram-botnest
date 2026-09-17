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
import type { InvalidationTarget } from './apiCache';

type Body = Record<string, unknown> | undefined;

export interface Rule {
  method: 'POST' | 'DELETE' | 'PATCH';
  pattern: RegExp;
  /** true — мутация меняет учётную запись целиком (напр. удаление аккаунта). */
  clearAll?: true;
  targets?: (match: RegExpMatchArray, body: Body) => InvalidationTarget[];
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;
const numStr = (v: unknown): string | undefined =>
  typeof v === 'number' || typeof v === 'string' ? String(v) : undefined;

/** Мутация без зависимости от body/id — фиксированный набор ключей. */
function simple(
  method: Rule['method'],
  pattern: RegExp,
  ...targets: InvalidationTarget[]
): Rule {
  return { method, pattern, targets: () => targets };
}

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
  simple('POST', /^\/api\/profile\/name$/, '/api/profile'),
  simple('POST', /^\/api\/diary\/schema$/, '/api/diary/schema'),
  simple('DELETE', /^\/api\/diary\/schema\/\d+$/, '/api/diary/schema'),
  simple('POST', /^\/api\/diary\/mode$/, '/api/diary/mode'),
  simple('DELETE', /^\/api\/diary\/mode\/\d+$/, '/api/diary/mode'),
  simple('POST', /^\/api\/diary\/gratitude$/, '/api/diary/gratitude'),
  simple('DELETE', /^\/api\/diary\/gratitude\/\d+$/, '/api/diary/gratitude'),
  simple('POST', /^\/api\/therapy\/join$/, '/api/therapy/relation'),
  simple('DELETE', /^\/api\/therapy\/relation$/, '/api/therapy/relation'),
  simple('POST', /^\/api\/therapy\/clients\/add$/, '/api/therapy/clients'),
  simple('POST', /^\/api\/therapy\/clients\/virtual$/, '/api/therapy/clients'),
  simple('DELETE', /^\/api\/therapy\/clients\/\d+$/, '/api/therapy/clients'),
  simple(
    'POST',
    /^\/api\/therapy\/rename-client\/\d+$/,
    '/api/therapy/clients',
  ),
  simple('POST', /^\/api\/therapy\/become-therapist$/, '/api/therapy/request'),
  simple('POST', /^\/api\/therapy\/request$/, '/api/therapy/request'),
  simple('POST', /^\/api\/therapy\/therapist-view$/, '/api/user-flags'),
  simple(
    'DELETE',
    /^\/api\/therapy\/therapist-role$/,
    '/api/user-flags',
    '/api/therapy/clients',
  ),
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/tasks$/,
    targets: (_m, body) => {
      const clientId = numStr(body?.clientId);
      return clientId
        ? ['/api/therapy/tasks', `/api/therapy/tasks/client/${clientId}`]
        : ['/api/therapy/tasks'];
    },
  },
  // completeTask(id) — clientId владельца задачи неизвестен из одного id.
  simple(
    'POST',
    /^\/api\/therapy\/tasks\/\d+\/complete$/,
    '/api/therapy/tasks',
    '/api/therapy/tasks/history',
    { prefix: '/api/therapy/tasks/client/' },
  ),
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/notes\/(\d+)$/,
    targets: (m) => [`/api/therapy/notes/${m[1]}`],
  },
  // deleteTherapistNote(noteId) — clientId заметки неизвестен из noteId.
  simple('DELETE', /^\/api\/therapy\/notes\/\d+$/, {
    prefix: '/api/therapy/notes/',
  }),
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/session-info\/(\d+)$/,
    targets: (m) => [
      `/api/therapy/client-data/${m[1]}`,
      '/api/therapy/clients',
    ],
  },
  simple('POST', /^\/api\/schema-notes$/, '/api/schema-notes'),
  simple('POST', /^\/api\/mode-notes$/, '/api/mode-notes'),
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/conceptualization\/(\d+)$/,
    targets: (m) => [`/api/therapy/conceptualization/${m[1]}`],
  },
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
];
