// Один чип-слот: кнопка-переключатель ручного слоя (SlotOverride) поверх
// недельного расписания. Цвет — только из палитры/color-mix (гейт
// check-color-drift: новый файл рождается с нулём hex/rgb-литералов).
import type { AdminCalendarCell, AdminCalendarCellState } from '../../../api';
import { cellAction, fmtChipTime, stateLabel } from './calendarModel';
import { chipStyles } from './chipStyles';

const HINT: Record<AdminCalendarCellState, string> = {
  free: 'Нажмите, чтобы закрыть',
  busy: 'Занято по календарю — нажмите, чтобы закрыть насовсем',
  extra: 'Открыт вручную — нажмите, чтобы убрать',
  blocked: 'Закрыто вручную — нажмите, чтобы открыть',
  off: 'Нажмите, чтобы открыть разово',
  booked: 'Запись отменяется во вкладке «Записи»',
};

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
  const label = stateLabel(cell.state);
  // booked не тускнеет намеренно — это факт («у вас встреча»), а не выключенный контрол.
  const opacity = cell.state === 'booked' ? 1 : cell.past ? 0.45 : pending ? 0.6 : 1;

  return (
    <button
      type="button"
      disabled={!clickable}
      aria-label={`${time} — ${label}`}
      title={HINT[cell.state]}
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
        maxWidth: cell.state === 'booked' ? 140 : undefined,
        ...chipStyles(cell.state),
      }}
    >
      {cell.state === 'booked' && cell.booking ? `${time} · ${cell.booking.clientName}` : time}
      {cell.busy && (cell.state === 'free' || cell.state === 'extra') && (
        <span
          aria-hidden
          title="В календаре встреча, а запись открыта — нажмите, чтобы закрыть"
          style={{
            position: 'absolute', top: 4, right: 4, width: 8, height: 8,
            borderRadius: 'var(--r-8)', background: 'var(--accent-yellow)',
          }}
        />
      )}
    </button>
  );
}
