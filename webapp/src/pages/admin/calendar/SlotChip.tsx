// Один чип-слот: кнопка-переключатель ручного слоя (SlotOverride) поверх
// недельного расписания. Цвет — только из палитры/color-mix (гейт
// check-color-drift: новый файл рождается с нулём hex/rgb-литералов).
import type { AdminCalendarCell, AdminCalendarCellState } from '../../../api';
import { cellAction } from './calendarModel';
import { chipLabel, fmtChipTime } from './calendarFormat';
import { chipStyles } from './chipStyles';

const HINT: Record<AdminCalendarCellState, string> = {
  free: 'Нажмите, чтобы закрыть',
  busy: 'Занято по календарю — нажмите, чтобы закрыть насовсем',
  extra: 'Открыт вручную — нажмите, чтобы убрать',
  blocked: 'Закрыто вручную — нажмите, чтобы открыть',
  off: 'Нажмите, чтобы открыть разово',
  booked: 'Запись отменяется во вкладке «Записи»',
};
// Прошедшая ячейка не нажимается независимо от state (в т.ч. «слишком скоро»
// — MIN_BOOK_LEAD_HOURS даёт тот же cell.past) — подсказка одна на всех.
const PAST_HINT = 'Прошло — клиент сюда уже не запишется';

export function SlotChip({
  cell, timezone, pending, onToggle,
}: {
  cell: AdminCalendarCell;
  timezone: string;
  pending: boolean;
  onToggle: (cell: AdminCalendarCell) => void;
}) {
  const action = cellAction(cell);
  const clickable = action !== null && !pending;
  const time = fmtChipTime(cell.startsAt, timezone);
  const label = chipLabel(cell);
  const isPastActive = cell.past && cell.state !== 'booked';
  // Название события из календаря — владелец видит, ЧЕМ занято, а не только «занято».
  const withTitle = !isPastActive && cell.state === 'busy' && !!cell.busyTitle;
  const title = isPastActive
    ? PAST_HINT
    : withTitle ? `${cell.busyTitle} — ${HINT.busy}` : HINT[cell.state];
  const text = cell.state === 'booked' && cell.booking
    ? `${time} · ${cell.booking.clientName}`
    : withTitle ? `${time} · ${cell.busyTitle}` : time;
  // booked не тускнеет намеренно — это факт («у вас встреча»), а не выключенный контрол.
  const opacity = cell.state === 'booked' ? 1 : cell.past ? 0.45 : pending ? 0.6 : 1;

  return (
    <button
      type="button"
      disabled={!clickable}
      aria-label={`${time} — ${label}`}
      title={title}
      onClick={() => action && onToggle(cell)}
      style={{
        position: 'relative',
        minHeight: 44,
        minWidth: 64,
        padding: '0 10px',
        borderRadius: 'var(--r-10)',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'inherit',
        fontVariantNumeric: 'tabular-nums',
        cursor: clickable ? 'pointer' : 'default',
        opacity,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: cell.state === 'booked' || withTitle ? 180 : undefined,
        ...chipStyles(cell.state, cell.past),
      }}
    >
      {text}
      {cell.busy && (cell.state === 'free' || cell.state === 'extra') && (
        <span
          aria-hidden
          title={`В календаре ${cell.busyTitle ? `«${cell.busyTitle}»` : 'встреча'}, а запись открыта — нажмите, чтобы закрыть`}
          style={{
            position: 'absolute', top: 4, right: 4, width: 8, height: 8,
            borderRadius: 'var(--r-8)', background: 'var(--accent-yellow)',
          }}
        />
      )}
    </button>
  );
}
