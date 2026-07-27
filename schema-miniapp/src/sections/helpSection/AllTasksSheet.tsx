import { api, UserTask } from '../../api';
import { BottomSheet } from '../../components/BottomSheet';
import { TaskRow } from '../../components/tasks/TaskRow';
import { TaskHistoryList } from '../../components/tasks/TaskHistoryList';
import { plural } from '../today/helpers';

// Лист «Мои цели» (активные задачи + история + добавление). Вынесено из
// HelpSection.tsx (правило №10). Поведение не менялось.
export function AllTasksSheet({
  tasks,
  taskHistory,
  onClose,
  onOpenTask,
  onReload,
  onAdd,
}: {
  tasks: UserTask[];
  taskHistory: UserTask[];
  onClose: () => void;
  onOpenTask: (task: UserTask) => void;
  onReload: () => void;
  onAdd: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 18,
          paddingTop: 4,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
            }}
          >
            Мои цели
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-faint)',
              marginTop: 4,
            }}
          >
            {tasks.length === 0
              ? 'Поставь себе цель и иди к ней маленькими шагами'
              : `${tasks.length} ${plural(tasks.length, 'активная', 'активные', 'активных')}${taskHistory.length > 0 ? ` · ${taskHistory.length} выполнено` : ''}`}
          </div>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            flexShrink: 0,
            background: 'rgba(251,146,60,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          🎯
        </div>
      </div>

      {/* Active tasks */}
      {tasks.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            background: 'var(--surface)',
            borderRadius: 16,
            border: '1px dashed var(--border-color)',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              lineHeight: 1.55,
              maxWidth: 240,
              margin: '0 auto',
            }}
          >
            Пока нет активных целей. Поставь первую — большие изменения
            начинаются с малого.
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onOpen={() => onOpenTask(task)}
              onComplete={
                task.done === null && task.type === 'custom'
                  ? () =>
                      api
                        .completeTask(task.id, true)
                        .then(onReload)
                        .catch(() => {})
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Completed history */}
      <TaskHistoryList taskHistory={taskHistory} variant="full" />

      {/* Add button */}
      <button
        onClick={onAdd}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 14,
          border: 'none',
          background:
            'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(167,139,250,0.10))',
          outline: '1px solid rgba(167,139,250,0.28)',
          color: 'var(--accent)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 18,
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 17 }}>+</span> Поставить цель
      </button>
    </BottomSheet>
  );
}
