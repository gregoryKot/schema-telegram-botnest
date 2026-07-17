// Task display helpers + progress bar for TodaySection

import { UserTask } from '../../api';
import { getTaskDisplayText } from '../../components/TaskCreateSheet';
import { ALL_SCHEMAS, ALL_MODES } from '../../schemaTherapyData';

export const TASK_EMOJI: Record<string, string> = {
  diary_streak: '📔',
  tracker_streak: '📊',
  belief_check: '🔍',
  letter_to_self: '✉️',
  safe_place: '🏡',
  childhood_wheel: '🌱',
  flashcard: '🆘',
  schema_intro: '🧩',
  mode_intro: '🔄',
  custom: '🎯',
};

export function resolveTaskDisplayText(task: UserTask): string {
  const text = getTaskDisplayText(task.type, task.text);
  if (text === task.text) {
    const schema = ALL_SCHEMAS.find((s) => s.id === task.text);
    if (schema) return schema.name;
    const mode = ALL_MODES.find((m) => m.id === task.text);
    if (mode) return mode.name;
  }
  return text;
}

export function resolveTaskEmoji(task: UserTask): string {
  if (TASK_EMOJI[task.type]) return TASK_EMOJI[task.type];
  if (ALL_SCHEMAS.some((s) => s.id === task.text)) return '🧩';
  if (ALL_MODES.some((m) => m.id === task.text)) return '🔄';
  return '🎯';
}

export function TaskProgressBar({ task }: { task: UserTask }) {
  if (task.type === 'custom' || !task.targetDays) return null;
  const target = task.targetDays;
  const progress =
    task.progress !== undefined ? Math.min(task.progress, target) : 0;
  const pct = target > 0 ? (progress / target) * 100 : 0;
  return (
    <div
      style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <div
        style={{
          flex: 1,
          height: 3,
          background: 'rgba(var(--fg-rgb),0.08)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--accent)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>
        {progress}/{target}
      </span>
    </div>
  );
}
