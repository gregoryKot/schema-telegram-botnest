// Своё у клиента в общем поиске: активные задания (от терапевта и свои цели) и планы «Практик».
// Данные — с сервера (usePaletteClientData.ts): нет заданий или планов — нет и строк.
import { planDateLabel } from '../../../../shared/src/practices/plansCopy';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { taskEntity } from '../../sections/practice/taskEntity';
import { taskTitleText } from '../../sections/practice/taskTitleText';
import { fmtDate } from '../../utils/format';
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteInput';

export const OWN_TASK_GROUP = 'Мои задания';
export const PLAN_GROUP = 'Мои планы';
/** Сколько активных заданий видно без запроса. */
export const OWN_TASKS_PREVIEW = 3;

/** Активные задания; выполненных в поиске нет. */
export function allOwnTaskRows({ own, tr, run }: PaletteInput): CmdRow[] {
  return own.tasks.filter((t) => t.done !== true).map((t) => ({
    key: `own_task:${t.id}`, kind: 'own_task', group: OWN_TASK_GROUP, label: taskTitleText(t, tr),
    sub: [t.assignedBy === null ? 'Своя цель' : 'От терапевта', t.dueDate && `до ${fmtDate(t.dueDate)}`].filter(Boolean).join(' · '),
    mark: { sign: ENTITY_LOOK[taskEntity(t)].sign }, search: taskTitleText(t, tr),
    action: () => run.ownTask(t.id),
  }));
}

/** Планы, свежие по дню первыми. */
export function allPlanRows({ own, run }: PaletteInput): CmdRow[] {
  return [...own.plans].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)).map((p) => ({
    key: `plan:${p.id}`, kind: 'plan', group: PLAN_GROUP, label: p.practiceText,
    sub: planDateLabel(p.scheduledDate) + (p.done ? ' · выполнен' : ''),
    mark: { sign: ENTITY_LOOK.plan.sign }, search: p.practiceText,
    action: () => run.practice({ kind: 'plans', focus: { id: p.id, date: p.scheduledDate } }),
  }));
}

/** Без запроса: первые активные задания и приглушённая строка «Ещё N» под последним из них. */
export function ownTasksPreview(input: PaletteInput): CmdRow[] {
  const { tr } = input;
  const rows = allOwnTaskRows(input);
  const rest = rows.length - OWN_TASKS_PREVIEW;
  if (rest <= 0) return rows;
  const shown = rows.slice(0, OWN_TASKS_PREVIEW);
  shown[OWN_TASKS_PREVIEW - 1] = { ...shown[OWN_TASKS_PREVIEW - 1], after: tr(`Ещё ${rest} — начни вводить название`, `Ещё ${rest} — начните вводить название`) };
  return shown;
}
