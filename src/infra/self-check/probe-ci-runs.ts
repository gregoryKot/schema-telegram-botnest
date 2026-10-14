import { Probe } from './types';
import { fetchLastRun, WorkflowRunsResponse } from './ci-runs-github';
import {
  NIGHTLY_MAX_AGE_HOURS,
  SMOKE_MAX_AGE_HOURS,
  staleNote,
} from './ci-run-age';

interface WorkflowSpec {
  file: string;
  /** Текст в detail, если последний завершённый прогон не success. */
  failMessage: (url: string) => string;
  /** Старше — воркфлоу не запускается вовсе (планировщик GitHub молчит). */
  maxAgeHours: number;
  notRunLabel: string;
}

const WORKFLOWS: WorkflowSpec[] = [
  {
    file: 'nightly.yml',
    failMessage: (url) => `ночная проверка упала: ${url}`,
    maxAgeHours: NIGHTLY_MAX_AGE_HOURS,
    notRunLabel: 'ночная проверка не запускалась',
  },
  {
    file: 'prod-smoke.yml',
    failMessage: (url) => `смок прода красный: ${url}`,
    maxAgeHours: SMOKE_MAX_AGE_HOURS,
    notRunLabel: 'смок не запускался',
  },
];

/**
 * Вторая линия за джобой `alarm` (nightly.yml, prod-smoke.yml): приложение
 * само спрашивает публичный REST GitHub (токен не нужен) о последнем
 * завершённом прогоне `main` каждого воркфлоу. Не success — проблема;
 * прогон старше порога (`ci-run-age.ts`) — тоже: «последний зелёный» от
 * вчера ничего не говорит, если планировщик GitHub смок не запускает.
 * Лимит API 60 запросов/час на IP, здесь 2 запроса в час. Слепое пятно:
 * проба внутри Nest и молчит, когда приложение не поднялось (упала
 * миграция, нет БД) — это закрывает DM из alarm и внешний монитор.
 *
 * reportInHealth: false — иначе петля: prod-smoke.yml сам читает
 * /health.selfCheck.failed (правило №21), и смок падал бы ПОТОМУ ЧТО проба
 * говорит, что он красный, а не потому что сам прогон упал. DM владельцу и
 * /stats проба видит как любую другую — флаг сужает только наружный /health.
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
        const stale = staleNote(
          run,
          wf.maxAgeHours,
          wf.notRunLabel,
          Date.now(),
        );
        if (stale) problems.push(stale);
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
