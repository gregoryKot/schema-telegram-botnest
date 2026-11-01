// Ввод дат в карточке клиента терапевта — «следующая сессия» и «начало
// терапии» (webapp ↔ schema-miniapp, правило №3). Даты здесь — настенные:
// терапевт вводит их по своим часам, поэтому «сегодня» — местный день
// (todayStr), а не день UTC (правило №25).
//
// QA 2026-10-26:
//  • «Следующая сессия» была одним полем datetime-local. Браузер отдаёт его
//    value пустым, пока не заполнены И день, И время, — день без времени
//    уходил как `{nextSession: null}`, и сохранённая сессия молча стиралась.
//    Теперь день и время — два поля: день без времени сохраняется днём
//    (сервер его принимает, карточки показывают «Вт, 27 окт»), время без
//    дня не сохраняется — с подсказкой.
//  • «Начало терапии» принимало будущий день: бейдж «в работе сегодня».
import { todayStr } from '../utils/format';

export interface SessionParts {
  date: string;
  /** ЧЧ:ММ или пусто */
  time: string;
}

/** Строка состояния → поля ввода. `2026-10-27T10:00:00` → день + «10:00». */
export function splitSession(value: string | null | undefined): SessionParts {
  const [date = '', time = ''] = (value ?? '').split('T');
  return { date, time: time.slice(0, 5) };
}

/** Поля → строка состояния. Время без дня хранится как `T10:00`: ввод не
 *  теряется, пока день не выбран. */
export function joinSession(date: string, time: string): string {
  return time ? `${date}T${time}` : date;
}

/** Что отправить серверу: `null` — сброс (оба поля пусты), день или день со
 *  временем; `undefined` — время без дня, сохранять нечего. */
export function sessionToSave(value: string): string | null | undefined {
  const { date, time } = splitSession(value);
  if (!date) return time ? undefined : null;
  return joinSession(date, time);
}

/** Подсказка под полями сессии; `null` — сохранять можно. */
export function sessionInputHint(value: string): string | null {
  return sessionToSave(value) === undefined
    ? 'Нужен день встречи: одно время не сохранится'
    : null;
}

/** Подсказка под «началом терапии»: будущий день не сохраняем (сервер
 *  откажет тоже). `null` — сохранять можно. */
export function startDateHint(
  day: string,
  today: string = todayStr(),
): string | null {
  return day && day > today ? 'Начало терапии не может быть в будущем' : null;
}
