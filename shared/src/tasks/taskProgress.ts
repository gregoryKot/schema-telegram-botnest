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
