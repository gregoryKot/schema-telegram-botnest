// Карточка одного дня недели: шапка (дата, счётчик свободных, кнопка на весь
// день) + ряд чипов-слотов. Пустой день — тонкая подпись, не пустота без причины.
import type { AdminCalendarCell, AdminCalendarDay } from '../../../api';
import { btnGhost } from '../shared';
import { dayAction, fmtDayTitle } from './calendarModel';
import { SlotChip } from './SlotChip';

export function DayCard({
  day, timezone, today, pending, onToggleCell, onDayAction,
}: {
  day: AdminCalendarDay;
  timezone: string;
  today: string;
  /** Общий набор ключей «идёт мутация» — ISO startsAt для ячеек, YYYY-MM-DD для дня целиком (форматы не пересекаются). */
  pending: Set<string>;
  onToggleCell: (cell: AdminCalendarCell) => void;
  onDayAction: (day: AdminCalendarDay, action: NonNullable<ReturnType<typeof dayAction>>) => void;
}) {
  const isToday = day.date === today;
  // Открытые вручную (extra) — такие же свободные для клиента, как и free по правилу.
  const freeCount = day.cells.filter((c) => (c.state === 'free' || c.state === 'extra') && !c.past).length;
  const action = dayAction(day.cells);
  const dayPending = pending.has(day.date);

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-10)', marginBottom: 10 }}>
        <strong style={{ fontSize: 14, fontWeight: isToday ? 700 : 600, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
          {fmtDayTitle(day.date)}
        </strong>
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {freeCount > 0 ? `${freeCount} свободно` : 'свободных нет'}
        </span>
        <span className="u-flex1" />
        {action && (
          <button
            type="button"
            disabled={dayPending}
            style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, opacity: dayPending ? 0.6 : 1 }}
            onClick={() => onDayAction(day, action)}
          >
            {action.label}
          </button>
        )}
      </div>
      {day.cells.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>Ячеек нет</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)' }}>
          {day.cells.map((cell) => (
            <SlotChip
              key={cell.startsAt}
              cell={cell}
              timezone={timezone}
              pending={pending.has(cell.startsAt)}
              onToggle={onToggleCell}
            />
          ))}
        </div>
      )}
    </div>
  );
}
