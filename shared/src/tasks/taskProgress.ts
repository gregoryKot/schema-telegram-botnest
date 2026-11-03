// Прогресс стрик-задачи — общий для обоих фронтендов (правило №3).
import type { UserTask } from '../apiTypes';

export interface TaskProgress {
  progress: number;
  target: number;
  pct: number;
}

/** Прогресс стрик-задачи (дневник/трекер N дней подряд). Берёт
 * серверно-посчитанный task.progress (реальные выполненные дни), а не
 * просто число прошедших дней. null для не-стрик задач (custom / без
 * targetDays). */
export function computeTaskProgress(task: UserTask): TaskProgress | null {
  if (task.type === 'custom' || !task.targetDays) return null;
  const target = task.targetDays;
  const progress =
    task.progress !== undefined ? Math.min(task.progress, target) : 0;
  const pct = target > 0 ? (progress / target) * 100 : 0;
  return { progress, target, pct };
}

/**
 * «1 из 7 дней» — прогресс серии словами для карточки задания у терапевта
 * (у клиента то же число полосой «1/7»). До 2026-10-26 терапевт видел только
 * «В работе». null — не серия или сервер прогресса не прислал: «0 из 7»
 * вместо «нет данных» было бы выдумкой.
 */
export function taskProgressLabel(task: UserTask): string | null {
  const p = computeTaskProgress(task);
  if (!p || task.progress === undefined) return null;
  const n = p.target % 100;
  const days = n % 10 === 1 && n !== 11 ? 'дня' : 'дней';
  return `${p.progress} из ${p.target} ${days}`;
}
