// Задания из справочника в общем поиске: строка каталога ведёт ко второму шагу «Кому дать задание?».
// Без клиентов и при «Показе экрана» строк нет: выбирать некого или имена скрыты.
import { ROW_SCORE, rowScore } from '../../../../shared/src/search/rankRows';
import { CATALOG_GROUP_TITLES, type CatalogTask } from '../../../../shared/src/tasks/catalog/taskCatalog';
import { THERAPIST_NAV } from '../appShell/navLook';
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteRows';

export const TASK_GROUP = 'Задания из справочника';
/** Сколько заданий видно по запросу. */
export const TASKS_SHOWN = 6;

/** Есть кому дать задание: клиенты загружены и их имена не скрыты. */
export function canAssign({ clients, screenShare }: Pick<PaletteInput, 'clients' | 'screenShare'>): boolean {
  return clients.length > 0 && !screenShare;
}

function taskRow(task: CatalogTask, run: PaletteInput['run']): CmdRow {
  return {
    key: `task:${task.id}`, kind: 'task', group: TASK_GROUP, label: task.title,
    sub: `Дать клиенту · ${CATALOG_GROUP_TITLES[task.group]}`, mark: { sign: THERAPIST_NAV.tasks.sign },
    search: task.title, stay: true, action: () => run.pickAssignee(task.id),
  };
}

/** Весь каталог — среди него «Недавнее» находит задание по ключу. */
export function allTaskRows(input: PaletteInput): CmdRow[] {
  return input.guide && canAssign(input) ? input.guide.tasks.map((task) => taskRow(task, input.run)) : [];
}

/** Задания, чьё название подходит запросу, лучшие первыми. */
export function taskRows(input: PaletteInput): { row: CmdRow; score: number }[] {
  return allTaskRows(input)
    .map((row) => ({ row, score: rowScore(row.label, '', input.query) }))
    .filter((r) => r.score > ROW_SCORE.none)
    .sort((a, b) => b.score - a.score)
    .slice(0, TASKS_SHOWN);
}
