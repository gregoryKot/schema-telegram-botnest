import { Probe } from './types';

const CI_RUNS_TIMEOUT_MS = 8_000;
const REPO = 'gregoryKot/schema-telegram-botnest';

interface WorkflowSpec {
  file: string;
  /** Текст в detail, если последний завершённый прогон не success. */
  failMessage: (url: string) => string;
}

const WORKFLOWS: WorkflowSpec[] = [
  {
    file: 'nightly.yml',
    failMessage: (url) => `ночная проверка упала: ${url}`,
  },
  {
    file: 'prod-smoke.yml',
    failMessage: (url) => `смок прода красный: ${url}`,
  },
];

interface WorkflowRunsResponse {
  workflow_runs?: Array<{
    conclusion?: string | null;
    html_url?: string;
  }>;
}

async function fetchLastRun(file: string): Promise<WorkflowRunsResponse> {
  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${file}/runs?status=completed&per_page=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'schemehappens-self-check',
    },
    signal: AbortSignal.timeout(CI_RUNS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GitHub API ответил HTTP ${res.status}`);
  return (await res.json()) as WorkflowRunsResponse;
}

/**
 * Наблюдатель за CI живёт в GitHub Actions (джоба `alarm` в nightly.yml и
 * prod-smoke.yml), но её DM зависит от секретов РЕПОЗИТОРИЯ (BOT_TOKEN,
 * ADMIN_ID) — их там нет, они заведены только на Amvera, где живёт
 * приложение (run 35103908387, job alarm — секретов не было, DM не ушёл).
 * Секреты в GitHub завести нельзя, поэтому наблюдатель переезжает туда, где
 * токен есть: приложение само спрашивает публичный REST GitHub (без токена,
 * репозиторий публичный) о последнем завершённом прогоне каждого воркфлоу.
 * Лимит — 60 запросов/час на IP, здесь 2 запроса в час (registry.ts + крон
 * самопроверки раз в час).
 *
 * reportInHealth: false — иначе получилась бы петля: prod-smoke.yml сам
 * читает /health.selfCheck.failed и красится на непустом списке (правило
 * №21 CLAUDE.md). Если бы «смок красный» тоже туда попадала, смок падал бы
 * ПОТОМУ ЧТО эта проба говорит, что он красный, а не потому что сам прогон
 * смока упал. DM владельцу и блок «Самопроверка» в /stats эту пробу видят
 * как любую другую — reportInHealth сужает только наружный /health.
 */
export function ciRunsProbe(): Probe {
  return {
    id: 'ciRuns',
    title: 'Ночная проверка и смок прода на GitHub',
    critical: false,
    reportInHealth: false,
    async run() {
      const problems: string[] = [];
      let emptyCount = 0;
      for (const wf of WORKFLOWS) {
        let body: WorkflowRunsResponse;
        try {
          body = await fetchLastRun(wf.file);
        } catch (e) {
          const msg = (e as Error)?.message?.slice(0, 150) ?? 'сеть недоступна';
          return {
            ok: false,
            detail: `не удалось узнать состояние CI: ${msg}`,
          };
        }
        const run = body.workflow_runs?.[0];
        if (!run) {
          emptyCount += 1;
          continue;
        }
        if (run.conclusion !== 'success') {
          problems.push(wf.failMessage(run.html_url ?? '(ссылки нет)'));
        }
      }
      if (problems.length > 0)
        return { ok: false, detail: problems.join('; ') };
      if (emptyCount === WORKFLOWS.length) {
        return { ok: true, detail: 'прогонов ещё не было' };
      }
      return { ok: true, detail: 'оба воркфлоу зелёные на GitHub' };
    },
  };
}
