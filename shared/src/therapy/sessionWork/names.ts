import { EXERCISES } from '../../exercises/exerciseCatalog';
import { EXERCISE_WORK_FIELDS, TECHNIQUE_WORK } from './fields';
import type { SessionWorkItem, SessionWorkKind } from './types';

export interface WorkOption {
  kind: SessionWorkKind;
  refId?: string;
  name: string;
}

const techniques: WorkOption[] = Object.entries(TECHNIQUE_WORK).map(
  ([refId, def]) => ({ kind: 'technique', refId, name: def.name }),
);
// Названия упражнений — из каталога «Практик», тем же именем, что у клиента.
const exercises: WorkOption[] = EXERCISES.filter(
  (e) => e.id in EXERCISE_WORK_FIELDS,
).map((e) => ({ kind: 'exercise', refId: e.id, name: e.title }));

/** Список выбора «Что делали»: три группы. */
export const WORK_OPTION_GROUPS: { title: string; options: WorkOption[] }[] = [
  { title: 'Техники', options: techniques },
  { title: 'Упражнения', options: exercises },
  { title: 'Своё', options: [{ kind: 'custom', name: 'Своё' }] },
];

/** Название пункта для заголовка и строки под записью. */
export function workTitle(item: SessionWorkItem): string {
  if (item.kind === 'custom') return item.customName || 'Своё';
  const list = item.kind === 'technique' ? techniques : exercises;
  return list.find((o) => o.refId === item.refId)?.name ?? '';
}

let seq = 0;
/** Новый пустой пункт выбранного вида; id уникален в пределах записи. */
export function newWorkItem(option: WorkOption): SessionWorkItem {
  seq += 1;
  return {
    id: `w${Date.now().toString(36)}${seq}`,
    kind: option.kind,
    ...(option.refId && { refId: option.refId }),
    modeIds: [],
    schemaIds: [],
    needIds: [],
    fields: {},
  };
}
