// История подсказок терапевту (#995): тихие серые строки рядом с пунктами
// плашки «Обычно в методе» и листов режима, схемы и техники сайта.
//   • «давали …» у пункта «Между сессиями» — по заданиям клиента (UserTask,
//     карточка клиента грузит их сама); без клиента (справочник) истории нет.
//   • «делали …» у техники — по отметкам «Делали сегодня» (techniqueMarks.ts).
// День задания — день назначения: `createdAt` — момент, показывается днём зоны
// терапевта (momentDayKey, правило №25). Статус — та же модель, что у карточки
// клиента и доски заданий (tasks/taskStatus.ts: taskStatus + STATUS_LABEL).
import type { BetweenSessionsItem } from '../../schemaTherapy/guide';
import type { ConceptTechniqueMark, UserTask } from '../../apiTypes';
import {
  STATUS_LABEL,
  taskStatus,
  type TaskStatus,
} from '../../tasks/taskStatus';
import { fmtDate, todayStr } from '../../utils/format';
import { dateStringMs } from '../../utils/calendarDate';
import { momentDayKey } from '../../utils/momentDate';
import { pluralRu } from '../../utils/pluralRu';
import type { GuideFrom } from './conceptGuide';
import { techniqueMarkHistory, techniqueMarkLabel } from './techniqueMarks';

/** Задание клиента — поля, по которым его узнаёт история и считается статус. */
export type GuideTask = Pick<
  UserTask,
  'type' | 'text' | 'done' | 'dueDate' | 'createdAt'
>;

export interface GuideTaskHistory {
  count: number;
  last: { day: string; status: TaskStatus };
}

/**
 * Это задание дано по пункту? Упражнение из «Практик» — по типу, а карточка
 * режима или схемы — ещё и по id в тексте задания (taskPayload.ts кладёт туда
 * id). Своё задание — по первой строке: «Дать заданием» пишет название, перевод
 * строки и инструкцию (guideAssign.ts), инструкцию терапевт мог переписать.
 */
function isItemTask(
  item: BetweenSessionsItem,
  from: GuideFrom,
  t: GuideTask,
): boolean {
  if (item.kind === 'custom') {
    return (
      t.type === 'custom' &&
      (t.text === item.title || t.text.startsWith(`${item.title}\n`))
    );
  }
  if (t.type !== item.type) return false;
  if (item.type === 'mode_intro' || item.type === 'schema_intro') {
    return t.text === from.id;
  }
  return true;
}

/**
 * Сколько раз давали пункт и что с последним заданием; ни разу — null.
 * `today` — местный день терапевта, как у карточки клиента (ClientTasksTab).
 */
export function guideTaskHistory(
  item: BetweenSessionsItem,
  from: GuideFrom,
  tasks: readonly GuideTask[],
  today: string = todayStr(),
): GuideTaskHistory | null {
  const given = tasks.filter((t) => isItemTask(item, from, t));
  if (given.length === 0) return null;
  // Нечитаемый createdAt (NaN) последним не станет: NaN > x всегда ложно.
  const last = given.reduce((a, b) =>
    dateStringMs(b.createdAt) > dateStringMs(a.createdAt) ? b : a,
  );
  return {
    count: given.length,
    last: {
      day: momentDayKey(last.createdAt),
      status: taskStatus(last, today),
    },
  };
}

// Подпись статуса из кабинета посреди строки — со строчной: «· не вышло».
const statusWord = (s: TaskStatus) =>
  STATUS_LABEL[s].charAt(0).toLowerCase() + STATUS_LABEL[s].slice(1);

/** «давали 12 окт · выполнено» / «давали 3 раза, последний 12 окт · в работе». */
export function guideTaskLabel({ count, last }: GuideTaskHistory): string {
  const day = last.day ? fmtDate(last.day) : '';
  const when =
    count === 1
      ? `давали ${day}`
      : `давали ${count} ${pluralRu(count, 'раз', 'раза', 'раз')}, последний ${day}`;
  return `${when.trimEnd()} · ${statusWord(last.status)}`;
}

/** Строки истории раздела: у пункта «Между сессиями» и у техники; нечего сказать — null. */
export interface GuideNotes {
  task: (item: BetweenSessionsItem) => string | null;
  technique: (techniqueId: string) => string | null;
}

/**
 * История раздела `from` — одна на плашку и листы. `tasks` нет (справочник
 * без клиента) — строк «давали» нет; `marks` — отметки связи этого режима
 * или схемы.
 */
export function guideNotes(
  from: GuideFrom,
  tasks: readonly GuideTask[] | undefined,
  marks: ConceptTechniqueMark[] | undefined,
): GuideNotes {
  return {
    task: (item) => {
      const h = tasks ? guideTaskHistory(item, from, tasks) : null;
      return h ? guideTaskLabel(h) : null;
    },
    technique: (id) => {
      const h = techniqueMarkHistory(marks, id);
      return h ? techniqueMarkLabel(h) : null;
    },
  };
}
