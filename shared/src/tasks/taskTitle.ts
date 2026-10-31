// Человекочитаемое название задания — общее для обоих фронтендов и для
// обеих сторон (клиент и терапевт), правило №3. Раньше жило четырьмя копиями
// (TaskCreateSheet и tasks/taskEmoji мини-аппа, taskDisplayText и два
// resolveTaskText сайта); терапевтские экраны их не звали и показывали сырой
// id режима («invincible_oc») вместо названия.
import type { UserTask } from '../apiTypes';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapy/schemaTherapyData';

export interface LegacyTaskTarget {
  type: 'schema' | 'mode';
  id: string;
  name: string;
}

/** Название по типу: schema_intro/mode_intro хранят в text id схемы/режима. */
export function getTaskDisplayText(type: string, text: string): string {
  if (type === 'schema_intro') {
    const s = ALL_SCHEMAS.find((x) => x.id === text);
    return s ? `Карточка схемы: ${s.name}` : 'Карточка схемы';
  }
  if (type === 'mode_intro') {
    const m = ALL_MODES.find((x) => x.id === text);
    return m ? `Карточка режима: ${m.name}` : 'Карточка режима';
  }
  return text;
}

/** Задачи старого формата хранили id схемы/режима прямо в task.text без
 * типа schema_intro/mode_intro. Общий лукап для отображения и диспатча
 * открытия карточки. */
export function findLegacyTaskTarget(text: string): LegacyTaskTarget | null {
  const schema = ALL_SCHEMAS.find((s) => s.id === text);
  if (schema) return { type: 'schema', id: schema.id, name: schema.name };
  const mode = ALL_MODES.find((m) => m.id === text);
  if (mode) return { type: 'mode', id: mode.id, name: mode.name };
  return null;
}

/**
 * compact: без префикса «Карточка схемы/режима: » у задач старого формата —
 * для плотных списков; full: с префиксом — для полных листов и экранов
 * терапевта.
 */
export function resolveTaskDisplayText(
  task: Pick<UserTask, 'type' | 'text'>,
  variant: 'full' | 'compact' = 'full',
): string {
  const text = getTaskDisplayText(task.type, task.text);
  if (text !== task.text) return text;
  const legacy = findLegacyTaskTarget(task.text);
  if (!legacy) return text;
  if (variant === 'compact') return legacy.name;
  return legacy.type === 'schema'
    ? `Карточка схемы: ${legacy.name}`
    : `Карточка режима: ${legacy.name}`;
}
