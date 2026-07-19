// Резолвинг иконки/текста задачи + фолбэк для задач старого формата (raw
// schema/mode id вместо typed task.type). Раньше жило отдельными копиями в
// HelpSection.tsx и TodaySection.tsx (свип дублей 2026-07) — теперь общий
// источник правды для обоих экранов.
import { UserTask } from '../../api';
import { getTaskDisplayText } from '../TaskCreateSheet';
import { ALL_SCHEMAS, ALL_MODES } from '../../schemaTherapyData';

// custom: '✏️' (не '🎯') — 🎯 уже занят иконкой самого виджета «Мои цели»
// в обоих экранах, совпадение с ней делало бы произвольную задачу
// неотличимой от общей иконки целей.
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
  custom: '✏️',
};

interface LegacyTarget {
  type: 'schema' | 'mode';
  id: string;
  name: string;
}

/** Задачи старого формата хранили id схемы/режима прямо в task.text без
 * типа schema_intro/mode_intro. Общий лукап для отображения, иконки и
 * диспатча открытия — раньше был раскопирован в 3 местах. */
export function findLegacyTaskTarget(text: string): LegacyTarget | null {
  const schema = ALL_SCHEMAS.find((s) => s.id === text);
  if (schema) return { type: 'schema', id: schema.id, name: schema.name };
  const mode = ALL_MODES.find((m) => m.id === text);
  if (mode) return { type: 'mode', id: mode.id, name: mode.name };
  return null;
}

/**
 * compact: без префикса «Карточка схемы/режима: » — для плотных списков
 * (сегодняшний экран), full: с префиксом — для полного листа «Мои цели».
 */
export function resolveTaskDisplayText(
  task: UserTask,
  variant: 'full' | 'compact' = 'full',
): string {
  const text = getTaskDisplayText(task.type, task.text);
  if (text === task.text) {
    const legacy = findLegacyTaskTarget(task.text);
    if (legacy?.type === 'schema') {
      return variant === 'full'
        ? `Карточка схемы: ${legacy.name}`
        : legacy.name;
    }
    if (legacy?.type === 'mode') {
      return variant === 'full'
        ? `Карточка режима: ${legacy.name}`
        : legacy.name;
    }
  }
  return text;
}

// Фолбэк для полностью нераспознанного типа — намеренно не совпадает ни с
// одной из конкретных иконок (в т.ч. с TASK_EMOJI.custom и с общей 🎯),
// чтобы «неизвестная задача» не читалась как что-то конкретное.
export function resolveTaskEmoji(task: UserTask): string {
  if (TASK_EMOJI[task.type]) return TASK_EMOJI[task.type];
  const legacy = findLegacyTaskTarget(task.text);
  if (legacy?.type === 'schema') return '🧩';
  if (legacy?.type === 'mode') return '🔄';
  return '⏳';
}
