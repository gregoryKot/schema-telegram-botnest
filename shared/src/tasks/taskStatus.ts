// Статус задания у терапевта — одна модель на обе площадки и на все экраны
// терапевта: карточка клиента (ClientTasksTab сайта, TasksSheet мини-аппа) и
// доска «Все клиенты → Задания» (KanbanView). До 2026-10-26 «не вышло»
// (`done: false` — серия не набралась к сроку, бэкенд закрывает её сам)
// карточка считала активным и «В работе», а доска — «Не вышло»: одно задание
// жило у терапевта в двух статусах (QA-проход 2026-10-26).
import type { UserTask } from '../apiTypes';
import { fmtDate } from '../utils/format';
import { momentDayKey } from '../utils/momentDate';
import { taskProgressLabel } from './taskProgress';

export type TaskStatus = 'done' | 'failed' | 'overdue' | 'soon' | 'active';

/** «Скоро срок» — осталось не больше стольких дней. */
export const SOON_DAYS = 2;

const DAY_MS = 86_400_000;
const dayNum = (ymd: string) =>
  Math.floor(Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`) / DAY_MS);

export function taskStatus(
  t: Pick<UserTask, 'done' | 'dueDate'>,
  today: string,
): TaskStatus {
  if (t.done === true) return 'done';
  if (t.done === false) return 'failed';
  if (!t.dueDate) return 'active';
  const left = dayNum(t.dueDate) - dayNum(today);
  if (left < 0) return 'overdue';
  return left <= SOON_DAYS ? 'soon' : 'active';
}

/** Ещё ждёт клиента: не выполнено и не закрыто как «не вышло». */
export const isOpenStatus = (s: TaskStatus) =>
  s === 'active' || s === 'soon' || s === 'overdue';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  done: 'Выполнено',
  failed: 'Не вышло',
  overdue: 'Просрочено',
  soon: 'Скоро срок',
  active: 'В работе',
};

// Сначала то, что требует внимания: просроченное, скорый срок, в работе;
// затем «не вышло» (повод обсудить на встрече) и выполненное.
const RANK: Record<TaskStatus, number> = {
  overdue: 0,
  soon: 1,
  active: 2,
  failed: 3,
  done: 4,
};

/** Порядок списка; внутри одного статуса — как пришло с сервера (новые сверху). */
export function orderTasks<T extends Pick<UserTask, 'done' | 'dueDate'>>(
  tasks: T[],
  today: string,
): T[] {
  return tasks
    .map((t, i) => ({ t, i, r: RANK[taskStatus(t, today)] }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.t);
}

/**
 * Подпись под заданием: у закрытых — когда закрыто (срок уже не важен, «до
 * …» у выполненного путало), у открытых — срок или дата назначения; у серии
 * — прогресс «1 из 7 дней», который клиент видит у себя полосой.
 */
export function taskMeta(t: UserTask, status: TaskStatus): string {
  const closedOn = t.completedAt ? momentDayKey(t.completedAt) : '';
  let head: string;
  if (status === 'done')
    head = closedOn ? `выполнено ${fmtDate(closedOn)}` : 'выполнено';
  else if (status === 'failed')
    head = closedOn ? `закрыто ${fmtDate(closedOn)}` : 'закрыто';
  else if (t.dueDate) head = `до ${fmtDate(t.dueDate)}`;
  else head = `назначено ${fmtDate(momentDayKey(t.createdAt))}`;
  const progress = taskProgressLabel(t);
  return progress ? `${head} · ${progress}` : head;
}
