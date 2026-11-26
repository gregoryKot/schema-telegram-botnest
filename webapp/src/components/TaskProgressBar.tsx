// Прогресс стрик-цели («дневник 7 дней подряд»). Число берётся с сервера (task.progress — реальные выполненные
// дни), считает shared/computeTaskProgress. До 14 дней — штрих на день (мотив Strokes, мох), длиннее — полоса (b20).
import type { UserTask } from '../api';
import '../styles/task-progress.css';
import { computeTaskProgress } from '../../../shared/src/tasks/taskProgress';
import { progressSegments } from '../sections/practice/taskListModel';

export function TaskProgressBar({ task }: { task: UserTask }) {
  const p = computeTaskProgress(task);
  if (!p) return null;
  const segs = progressSegments(p.progress, p.target);
  return (
    <div className="tpb">
      <div className={segs ? 'tpb-track tpb-track--days' : 'tpb-track'} role="progressbar"
        aria-valuemin={0} aria-valuemax={p.target} aria-valuenow={p.progress} aria-label="Выполнено дней">
        {segs
          ? segs.map((on, i) => <i key={i} className={on ? 'tpb-day is-on' : 'tpb-day'} />)
          : <div className="tpb-fill" style={{ width: `${p.pct}%` }} />}
      </div>
      <span className="tpb-num">{p.progress}/{p.target}</span>
    </div>
  );
}
