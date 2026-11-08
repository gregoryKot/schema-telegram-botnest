const CI_RUNS_TIMEOUT_MS = 8_000;
const REPO = 'gregoryKot/schema-telegram-botnest';

export interface WorkflowRun {
  conclusion?: string | null;
  html_url?: string;
  updated_at?: string | null;
  run_started_at?: string | null;
}

export interface WorkflowRunsResponse {
  workflow_runs?: WorkflowRun[];
}

/**
 * Последний завершённый прогон воркфлоу — только ветки main. Без `branch`
 * ручной прогон на ветке PR (workflow_dispatch) становился бы «последним» и
 * подменял собой плановые прогоны прода.
 */
export async function fetchLastRun(
  file: string,
): Promise<WorkflowRunsResponse> {
  const url = `https://api.github.com/repos/${REPO}/actions/workflows/${file}/runs?branch=main&status=completed&per_page=1`;
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
