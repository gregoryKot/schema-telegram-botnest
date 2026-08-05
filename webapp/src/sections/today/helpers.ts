import type { UserTask } from '../../api';
import { getTaskDisplayText } from '../../components/taskDisplayText';
import { ALL_SCHEMAS, ALL_MODES } from '../../schemaTherapyData';

// Хелперы экрана «Сегодня» (приветствие, дата, резолв текста/эмодзи задач).
// Вынесено из TodaySection.tsx (правило №10).

export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  if (h >= 18 && h < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

export function formatHeaderDate(): string {
  const now = new Date();
  const dow  = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return `${dow[0].toUpperCase()}${dow.slice(1)}, ${date}`;
}

export function readLocalIds(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}

export function resolveTaskText(task: UserTask): string {
  const text = getTaskDisplayText(task.type, task.text);
  if (text === task.text) {
    const schema = ALL_SCHEMAS.find(s => s.id === task.text);
    if (schema) return schema.name;
    const mode = ALL_MODES.find(m => m.id === task.text);
    if (mode) return mode.name;
  }
  return text;
}

// Маркер состояния — типографика (правило "род/ты-вы/эмодзи" CLAUDE.md, R4):
// сделано ✓, не сделано ×, ещё не решено (в работе) ·.
export function taskStatusMark(done: boolean | null): string {
  if (done === true)  return '✓';
  if (done === false) return '×';
  return '·';
}
