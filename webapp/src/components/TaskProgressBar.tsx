// Прогресс стрик-цели («дневник 7 дней подряд») — паритет с мини-аппом
// (schema-miniapp/.../TaskProgressBar.tsx). Число берётся с сервера
// (task.progress — реальные выполненные дни), считает shared/computeTaskProgress.
import type { UserTask } from '../api';
import '../styles/task-progress.css';
import { computeTaskProgress } from '../../../shared/src/tasks/taskProgress';

export function TaskProgressBar({ task }: { task: UserTask }) {
  const p = computeTaskProgress(task);
  if (!p) return null;
  return (
    <div className="tpb">
      <div
        className="tpb-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={p.target}
        aria-valuenow={p.progress}
        aria-label="Выполнено дней"
      >
        <div className="tpb-fill" style={{ width: `${p.pct}%` }} />
      </div>
      <span className="tpb-num">{p.progress}/{p.target}</span>
    </div>
  );
}
