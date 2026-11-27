// Сводка заданий клиента для терапевта: строка у сессии на «Сегодня» и отметка в
// списке клиентов. «Выполнено» считается с прошлой встречи — к ней терапевт и
// готовится; прошлой встречи не знаем — за последнюю неделю.
import type { UserTask } from '../apiTypes';
import { previousSessionDay } from '../therapy/upcomingSession';
import { dateStringMs } from '../utils/calendarDate';
import { momentDayKey } from '../utils/momentDate';
import { isOpenStatus, taskStatus } from './taskStatus';

const DAY_MS = 86_400_000;
/** Прошлая встреча неизвестна — «недавно» это столько дней. */
export const RECENT_DAYS = 7;

const dayBefore = (today: string, n: number) =>
  new Date(dateStringMs(today) - n * DAY_MS).toISOString().slice(0, 10);

interface Meetings {
  nextSession: string | null;
  meetingDays?: readonly number[] | null;
}

export interface TaskDigest {
  /** Выполнено с прошлой встречи (или за неделю, если её не знаем). */
  done: number;
  /** Ещё ждут клиента: в работе, скоро срок, просрочено. */
  waiting: number;
  /** Отсчёт «выполнено» — от известной прошлой встречи. */
  sinceSession: boolean;
}

export function taskDigest(
  tasks: readonly Pick<UserTask, 'done' | 'dueDate' | 'completedAt'>[],
  client: Meetings,
  today: string,
): TaskDigest {
  const prev = previousSessionDay(
    client.nextSession,
    client.meetingDays,
    today,
  );
  const from = prev ?? dayBefore(today, RECENT_DAYS);
  const doneSince = (t: (typeof tasks)[number]) =>
    t.done === true && !!t.completedAt && momentDayKey(t.completedAt) >= from;
  return {
    done: tasks.filter(doneSince).length,
    waiting: tasks.filter((t) => isOpenStatus(taskStatus(t, today))).length,
    sinceSession: prev !== null,
  };
}

/** Строка у сессии на «Сегодня»; нечего сказать — null (строки нет вовсе). */
export function sessionTasksLine(d: TaskDigest): string | null {
  if (d.done === 0 && d.waiting === 0) return null;
  return `задания: ${d.done} выполнено · ${d.waiting} ждёт`;
}

/** Отметка в строке клиента в списке: только когда есть выполненные. */
export function rosterTasksMark(d: TaskDigest): string | null {
  if (d.done === 0) return null;
  return d.sinceSession
    ? `выполнено с прошлой встречи: ${d.done}`
    : `выполнено за неделю: ${d.done}`;
}
