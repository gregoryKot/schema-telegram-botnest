// Чистые функции календаря слотов: переходы состояний (что происходит по
// нажатию на ячейку/день) и арифметика окна недели. Без React, без побочных
// эффектов. Текст для экрана (даты, слова-состояния) — в calendarFormat.ts
// рядом (файл не должен перевалить потолок ~150 строк, правило №10 CLAUDE.md).
// Никаких new Date('…T00:00:00') без Z (инцидент 2026-09-17, правило №25
// CLAUDE.md): календарный день — всегда полночь UTC, арифметика — через
// dateStringMs из shared/src/utils/calendarDate.ts.
import { dateStringMs } from '../../../../../shared/src/utils/calendarDate';
import type { AdminCalendarCell, SlotOverridePatch } from '../../../api';

const DAY_MS = 24 * 60 * 60 * 1000;

/** ms (кратные суткам UTC) → календарная строка YYYY-MM-DD. */
function msToDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Сегодняшний календарный день в переданной зоне (заголовок «Сегодня», подсветка текущего дня). */
export function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(new Date());
}

/**
 * Календарная неделя, содержащая dateStr, — с ВОСКРЕСЕНЬЯ по субботу
 * (решение владельца 2026-09-20: его неделя начинается с воскресенья).
 * До этого была Пн..Вс, и открытый в воскресенье календарь показывал шесть
 * прошедших дней перед «сегодня». Прошедшие дни внутри недели теперь
 * рисуются серым «прошло» (SlotChip/chipStyles), так что открытие в субботу
 * читается как «неделя на исходе», а не как поломка.
 */
export function weekOf(dateStr: string): { from: string; to: string } {
  const ms = dateStringMs(dateStr);
  const sundayMs = ms - new Date(ms).getUTCDay() * DAY_MS; // getUTCDay: 0 = воскресенье; ms — уже полночь UTC
  return { from: msToDateStr(sundayMs), to: msToDateStr(sundayMs + 6 * DAY_MS) };
}

/** Сдвиг на deltaWeeks недель (отрицательный — назад); воскресенье остаётся воскресеньем. */
export function shiftWeek(from: string, deltaWeeks: number): { from: string; to: string } {
  return weekOf(msToDateStr(dateStringMs(from) + deltaWeeks * 7 * DAY_MS));
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
