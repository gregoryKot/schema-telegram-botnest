// AllTasksSheet — bottom sheet listing all tasks + history (extracted from TodaySection.tsx).

import { api, UserTask } from '../../api';
import { BottomSheet } from '../../components/BottomSheet';
import { TaskRow } from '../../components/tasks/TaskRow';
import { TaskHistoryList } from '../../components/tasks/TaskHistoryList';

export function AllTasksSheet({
  tasks,
  taskHistory,
  setTasks,
  setTaskHistory,
  onClose,
  onCreate,
}: {
  tasks: UserTask[];
  taskHistory: UserTask[];
  setTasks: (t: UserTask[]) => void;
  setTaskHistory: (t: UserTask[]) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 20,
        }}
      >
        Все задания
      </div>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          variant="compact"
          onComplete={() =>
            api
              .completeTask(task.id, true)
              .then(() =>
                Promise.all([api.getTasks(), api.getTaskHistory()]).then(
                  ([t, h]) => {
                    setTasks(t);
                    setTaskHistory(h);
                  },
                ),
              )
              .catch(() => {})
          }
        />
      ))}
      <TaskHistoryList taskHistory={taskHistory} variant="compact" />
      <button
        onClick={onCreate}
        style={{
          marginTop: 16,
          width: '100%',
          padding: '13px 0',
          borderRadius: 14,
          border: 'none',
          background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
          color: 'var(--accent)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Поставить цель
      </button>
    </BottomSheet>
  );
}
