import { WorkflowRun } from './ci-runs-github';

const HOUR_MS = 3_600_000;

/**
 * Предельный возраст последнего прогона смока. Крон просит тик раз в 15
 * минут, но фактический шаг schedule-прогонов GitHub — 3–7 часов (аудит
 * 2026-10-11, 846 прогонов с 2026-08-10). Восемь часов — максимум
 * замеренного шага плюс запас на дребезг: старше значит, что планировщик
 * GitHub не запускает смок вовсе, и «последний зелёный» ничего не говорит.
 */
export const SMOKE_MAX_AGE_HOURS = 8;

/** Ночной прогон просят раз в сутки; 36 часов — сутки плюс полсуток запаса. */
export const NIGHTLY_MAX_AGE_HOURS = 36;

/**
 * Сколько часов назад стартовал прогон. null — GitHub не отдал время или оно
 * не разобралось: возраст тогда не судим (conclusion проба всё равно сверит).
 */
export function runAgeHours(run: WorkflowRun, nowMs: number): number | null {
  const at = Date.parse(run.run_started_at ?? run.updated_at ?? '');
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((nowMs - at) / HOUR_MS));
}

/** Строка про протухший прогон или null, если прогон свежий (или возраста нет). */
export function staleNote(
  run: WorkflowRun,
  maxAgeHours: number,
  notRunLabel: string,
  nowMs: number,
): string | null {
  const age = runAgeHours(run, nowMs);
  if (age === null || age <= maxAgeHours) return null;
  return `${notRunLabel} ${age} ч (последний прогон: ${run.html_url ?? 'ссылки нет'})`;
}
