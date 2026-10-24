// Типы календаря слотов в админке (вкладка «Запись» → «Расписание»).
// Вынесено из api.types.ts отдельным файлом, чтобы не раздувать его сверх
// бейслайна (правило №10) — ре-экспорт из api.types.ts одной строкой.

/** Причина ручного слоя: закрыть время (BLOCK) или открыть разово вне правил (OPEN). */
export type SlotOverrideKind = 'BLOCK' | 'OPEN';

/**
 * Состояние ячейки — приоритет сверху вниз (побеждает первое совпавшее):
 *   booked  — наша бронь (HELD/CONFIRMED), нажатие недоступно (отмена — во вкладке «Записи»);
 *   blocked — закрыто вручную (SlotOverride.kind=BLOCK), нажатие открывает;
 *   busy    — встреча из Apple Calendar И блокировка слотов включена, нажатие закрывает насовсем;
 *   extra   — открыто вручную вне правил (SlotOverride.kind=OPEN), нажатие убирает;
 *   free    — открыто правилом расписания, нажатие закрывает;
 *   off     — вне правил расписания, нажатие открывает разово.
 */
export type AdminCalendarCellState = 'booked' | 'blocked' | 'busy' | 'extra' | 'free' | 'off';

export interface AdminCalendarCell {
  startsAt: string; // ISO UTC — момент, не календарный день
  durationMin: number;
  state: AdminCalendarCellState;
  busy: boolean; // встреча пересекает ячейку НЕЗАВИСИМО от state — при выключенной блокировке слот может быть free И busy разом
  past: boolean; // startsAt <= now + MIN_BOOK_LEAD_HOURS — клиент всё равно не запишется, ячейка не нажимается
  booking?: { id: number; clientName: string; status: 'HELD' | 'CONFIRMED' };
  /** Названия событий календаря, пересекающих ячейку (через « · »), — только владельцу, за x-admin-key. */
  busyTitle?: string;
  /** startsAt строки SlotOverride у blocked/extra — clear идёт по нему (BLOCK действует по пересечению и может не совпадать с startsAt ячейки). */
  overrideStartsAt?: string;
}

export interface AdminCalendarDay {
  date: string; // YYYY-MM-DD в зоне правил
  cells: AdminCalendarCell[]; // по startsAt asc
}

export interface AdminCalendar {
  timezone: string;
  calendarConnected: boolean; // CalDAV настроен (calDav.enabled)
  calendarBlocking: boolean; // CALENDAR_BLOCK_SLOTS === 'true'
  calendarReadError: string | null; // чтение занятости упало — в «занято» не хватает части интервалов
  days: AdminCalendarDay[]; // по одному на каждый день диапазона, по порядку
}

export interface SlotOverrideItem {
  startsAt: string; // ISO
  durationMin: number; // 15..180
  kind: SlotOverrideKind;
}

/** Тело POST .../overrides — set/clear применяются в одной транзакции на бэке. */
export interface SlotOverridePatch {
  set?: SlotOverrideItem[];
  clear?: string[]; // ISO startsAt
}
