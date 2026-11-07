import { Probe } from './types';
import { REPO } from './ci-runs-github';

// D-1 аудитов 2026-10 и 2026-11 (docs/open/security.md): дамп боевой БД
// `scripts/railway_data.sql` (данные 17 человек открытым текстом) удалён из
// дерева PR #128 и `main` перезаписан, но коммиты держат ссылки
// `refs/pull/N/head`, которые force-push не трогает, — дамп читается с GitHub
// анонимно. Убрать его может только владелец (запрос в поддержку GitHub или
// приватный репозиторий). До 2026-11-07 документ называл эту пробу
// существующей, а кода не было: статус «ждёт владельца» жил только в тексте,
// /health и /stats молчали.
//
// Как проверяем: Git Trees API отдаёт список имён каталога `scripts/` в базе
// PR #128 — без содержимого файлов, персональные данные по сети не ходят.
// 404 — дерева больше нет (репозиторий приватный или GitHub собрал мусор).

/** Дерево каталога `scripts/` в базе PR #128 (коммит 8ebee87, 2026-07-20). */
export const DUMP_TREE_SHA = 'a3d82cc8c312ef37cae99b6a529ec91e264590c5';
export const DUMP_FILE = 'railway_data.sql';
const TIMEOUT_MS = 8_000;

interface GitTreeResponse {
  tree?: { path?: string }[];
}

export const DUMP_PUBLIC_DETAIL =
  'дамп боевой БД (данные 17 человек) ещё читается с GitHub анонимно через PR #128 — ' +
  'нужен запрос в поддержку GitHub на удаление или приватный репозиторий (docs/open/security.md, D-1)';

/**
 * reportInHealth: false — исправить может только владелец, а красный /health
 * держал бы prod-smoke.yml красным неделями и прятал бы настоящие аварии
 * (тот же довод, что у clinicalLabels). DM и /stats видят пробу как любую
 * другую. Без retryOnce: REST GitHub без токена — 60 запросов/ч на IP, его
 * делят с ciRuns.
 */
export function dumpStillPublicProbe(): Probe {
  return {
    id: 'dumpStillPublic',
    title: 'Дамп БД в публичной истории GitHub',
    reportInHealth: false,
    async run() {
      let res: Response;
      try {
        res = await fetch(
          `https://api.github.com/repos/${REPO}/git/trees/${DUMP_TREE_SHA}`,
          {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'schemehappens-self-check',
            },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          },
        );
      } catch (e) {
        const msg = (e as Error)?.message?.slice(0, 150) ?? 'сеть недоступна';
        return { ok: false, detail: `не удалось спросить GitHub: ${msg}` };
      }
      if (res.status === 404 || res.status === 422) {
        return { ok: true, detail: 'GitHub дамп больше не отдаёт' };
      }
      if (!res.ok) {
        return { ok: false, detail: `GitHub ответил HTTP ${res.status}` };
      }
      let body: GitTreeResponse;
      try {
        body = (await res.json()) as GitTreeResponse;
      } catch {
        return { ok: false, detail: 'GitHub ответил не JSON' };
      }
      const listed = (body.tree ?? []).some((e) => e.path === DUMP_FILE);
      return listed
        ? { ok: false, detail: DUMP_PUBLIC_DETAIL }
        : { ok: true, detail: 'в дереве PR #128 дампа нет' };
    },
  };
}
