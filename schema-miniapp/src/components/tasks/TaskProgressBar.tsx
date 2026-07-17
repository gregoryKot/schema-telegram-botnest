import { UserTask } from '../../api';

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

interface Props {
  task: UserTask;
  /** Today использует более тонкий/мелкий вид, чем полный лист «Мои цели». */
  dense?: boolean;
}

export function TaskProgressBar({ task, dense = false }: Props) {
  const p = computeTaskProgress(task);
  if (!p) return null;
  const barSize = dense ? 3 : 4;
  const fontSize = dense ? 10 : 11;
  return (
    <div
      style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <div
        style={{
          flex: 1,
          height: barSize,
          background: 'rgba(var(--fg-rgb),0.08)',
          borderRadius: barSize,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${p.pct}%`,
            height: '100%',
            background: 'var(--accent)',
            borderRadius: barSize,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize, color: 'var(--text-sub)' }}>
        {p.progress}/{p.target}
      </span>
    </div>
  );
}
