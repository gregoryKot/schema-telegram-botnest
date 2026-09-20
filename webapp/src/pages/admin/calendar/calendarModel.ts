// Чистые функции календаря слотов — без React, без побочных эффектов.
// Никаких new Date('…T00:00:00') без Z (инцидент 2026-09-17, правило №25
// CLAUDE.md): календарный день — всегда полночь UTC, арифметика — через
// dateStringMs/dateStringParts из shared/src/utils/calendarDate.ts.
import { dateStringMs, dateStringParts } from '../../../../../shared/src/utils/calendarDate';
import type {
  AdminCalendarCell,
  AdminCalendarCellState,
  SlotOverridePatch,
} from '../../../api';

const DAY_MS = 24 * 60 * 60 * 1000;

/** ms (кратные суткам UTC) → календарная строка YYYY-MM-DD. */
function msToDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Сегодняшний календарный день в переданной зоне (заголовок «Сегодня», подсветка текущего дня). */
export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date());
}

/** Понедельник..воскресенье недели, содержащей dateStr. */
export function weekRange(dateStr: string): { from: string; to: string } {
  const ms = dateStringMs(dateStr);
  const weekday = new Date(ms).getUTCDay(); // 0=вс…6=сб (dateStringMs — уже полночь UTC)
  const mondayOffsetDays = weekday === 0 ? -6 : 1 - weekday;
  const from = msToDateStr(ms + mondayOffsetDays * DAY_MS);
  const to = msToDateStr(dateStringMs(from) + 6 * DAY_MS);
  return { from, to };
}

/** Сдвиг недели на deltaWeeks (отрицательный — назад). */
export function shiftWeek(from: string, deltaWeeks: number): { from: string; to: string } {
  return weekRange(msToDateStr(dateStringMs(from) + deltaWeeks * 7 * DAY_MS));
}

/** Ключ снятия override'а: строка SlotOverride, а не ячейка — BLOCK по пересечению может стоять на другом времени. */
function clearKey(cell: AdminCalendarCell): string {
  return cell.overrideStartsAt ?? cell.startsAt;
}

/**
 * Что произойдёт по нажатию на ячейку (таблица нажатий из контракта).
 * Booked и прошедшие ячейки не нажимаются — отменять бронь можно только
 * во вкладке «Записи», а прошлое время клиент всё равно не займёт.
 */
export function cellAction(cell: AdminCalendarCell): SlotOverridePatch | null {
  if (cell.past) return null;
  switch (cell.state) {
    case 'free':
    case 'busy':
      return { set: [{ startsAt: cell.startsAt, durationMin: cell.durationMin, kind: 'BLOCK' }] };
    case 'blocked':
    case 'extra':
      return { clear: [clearKey(cell)] };
    case 'off':
      return { set: [{ startsAt: cell.startsAt, durationMin: cell.durationMin, kind: 'OPEN' }] };
    default:
      return null; // booked
  }
}

/**
 * Кнопка «закрыть/открыть весь день» — сводка cellAction по ячейкам дня.
 * Нет действия, если день состоит только из off/booked/прошедших ячеек:
 * открывать целый день разом — забота недельного правила, не ручного слоя.
 */
export function dayAction(
  cells: AdminCalendarCell[],
): { label: 'Закрыть день' | 'Открыть день'; patch: SlotOverridePatch } | null {
  const active = cells.filter((c) => !c.past);
  const closable = active.filter((c) => c.state === 'free' || c.state === 'busy' || c.state === 'extra');
  if (closable.length > 0) {
    const patch: SlotOverridePatch = {};
    const set = closable
      .filter((c) => c.state !== 'extra')
      .map((c) => ({ startsAt: c.startsAt, durationMin: c.durationMin, kind: 'BLOCK' as const }));
    const clear = closable.filter((c) => c.state === 'extra').map(clearKey);
    if (set.length) patch.set = set;
    if (clear.length) patch.clear = clear;
    return { label: 'Закрыть день', patch };
  }
  const blocked = active.filter((c) => c.state === 'blocked');
  // Один BLOCK может накрывать несколько ячеек — ключи дедуплицируются.
  if (blocked.length > 0) return { label: 'Открыть день', patch: { clear: [...new Set(blocked.map(clearKey))] } };
  return null;
}

const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']; // индекс = dateStringParts().weekday
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** 'HH:mm' времени старта ячейки в зоне правил (startsAt — момент, не календарный день). */
export function fmtChipTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** «Пн 21 сен» — свой формат вместо Intl: короткий месяц у Intl идёт с точкой («сент.»). */
export function fmtDayTitle(dateStr: string): string {
  const p = dateStringParts(dateStr);
  if (!p) return '';
  return `${DAYS_SHORT[p.weekday]} ${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

/** «21–27 сентября» внутри месяца, «28 сентября – 4 октября» на стыке. */
export function fmtWeekTitle(from: string, to: string): string {
  const a = dateStringParts(from);
  const b = dateStringParts(to);
  if (!a || !b) return '';
  if (a.month === b.month && a.year === b.year) return `${a.day}–${b.day} ${MONTHS_GENITIVE[a.month - 1]}`;
  return `${a.day} ${MONTHS_GENITIVE[a.month - 1]} – ${b.day} ${MONTHS_GENITIVE[b.month - 1]}`;
}

const STATE_LABELS: Record<AdminCalendarCellState, string> = {
  free: 'свободно',
  busy: 'встреча в календаре',
  booked: 'бронь',
  blocked: 'закрыто вручную',
  extra: 'открыто вручную',
  off: 'вне расписания',
};

/** Слово-состояние для aria-label чипа и подписи в легенде. */
export function stateLabel(state: AdminCalendarCellState): string {
  return STATE_LABELS[state];
}
