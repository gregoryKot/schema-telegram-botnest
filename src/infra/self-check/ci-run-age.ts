import { WorkflowRun } from './ci-runs-github';

const HOUR_MS = 3_600_000;

/**
 * Предельный возраст последнего прогона смока. Крон просит тик раз в 15
 * минут, но фактический шаг schedule-прогонов GitHub — обычно 3–7 часов
 * (аудит 2026-10-11, 846 прогонов с 2026-08-10), а самый длинный разрыв по
 * 500 прогонам смока на main с 2026-08-21 — 12,1 часа. Порог 14 часов —
 * этот максимум плюс запас: ниже него проба будила бы владельца ложной
 * тревогой на обычной паузе планировщика, а тревога, которая врёт, — та,
 * которую замьютят. Старше — планировщик GitHub не запускает смок вовсе.
 */
export const SMOKE_MAX_AGE_HOURS = 14;

/**
 * Ночной прогон просят раз в сутки, но разрывы между стартами на main доходят
 * до 33,5 часа (последние 60 завершённых прогонов), а возраст считается от
 * старта последнего ЗАВЕРШЁННОГО прогона — пока идёт следующий, к разрыву
 * добавляется его длительность (до двух часов). 40 часов — этот запас.
 */
export const NIGHTLY_MAX_AGE_HOURS = 40;

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
