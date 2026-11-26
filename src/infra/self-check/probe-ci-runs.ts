import { Probe } from './types';
import { fetchLastRun, WorkflowRunsResponse } from './ci-runs-github';
import { staleNote } from './ci-run-age';
import { WORKFLOWS } from './ci-workflows';

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
      return { ok: true, detail: 'воркфлоу зелёные на GitHub' };
    },
  };
}
