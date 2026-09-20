// Недельный календарь слотов: навигация по неделям + легенда состояний +
// предупреждения о календаре + список дней. Живёт внутри карточки «Расписание»
// ScheduleSection.tsx — своей секции/заголовка не рендерит.
import { useCallback, useMemo, useState } from 'react';
import { api } from '../../../api';
import type { AdminCalendar, AdminCalendarCell, AdminCalendarDay } from '../../../api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { Skeleton } from '../../../components/Skeleton';
import { btnGhost } from '../shared';
import { DayCard } from './DayCard';
import { chipStyles } from './chipStyles';
import { cellAction, dayAction, fmtWeekTitle, shiftWeek, stateLabel, todayIn, weekRange } from './calendarModel';
import type { AdminCalendarCellState } from '../../../api';

const LEGEND_STATES: AdminCalendarCellState[] = ['free', 'busy', 'booked', 'blocked', 'extra', 'off'];
// Зона правил неизвестна до первого ответа сервера — стартуем с МСК (типичная
// зона владельца), после ответа форматируем по data.timezone.
const START_TZ = 'Europe/Moscow';

export function CalendarWeek({ adminKey }: { adminKey: string }) {
  const [{ from, to }, setRange] = useState(() => weekRange(todayIn(START_TZ)));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [mutateError, setMutateError] = useState<string | null>(null);

  const fetcher = useCallback(() => api.adminCalendar(adminKey, from, to), [adminKey, from, to]);
  const { data, reload, failed } = useAsyncData<AdminCalendar | null>(fetcher, null, from);

  const timezone = data?.timezone ?? START_TZ;
  const today = useMemo(() => todayIn(timezone), [timezone]);

  const mutate = async (patch: NonNullable<ReturnType<typeof cellAction>>, key: string) => {
    setMutateError(null);
    setPending((p) => new Set(p).add(key));
    try {
      await api.adminSetOverrides(adminKey, patch);
      await reload();
    } catch (e) {
      setMutateError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(key); return n; });
    }
  };
  const onToggleCell = (cell: AdminCalendarCell) => {
    const patch = cellAction(cell);
    if (patch) void mutate(patch, cell.startsAt);
  };
  const onDayAction = (day: AdminCalendarDay, action: NonNullable<ReturnType<typeof dayAction>>) => {
    void mutate(action.patch, day.date);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', marginBottom: 6, flexWrap: 'wrap' }}>
        <button type="button" aria-label="Предыдущая неделя" style={{ ...btnGhost, padding: '4px 10px', fontSize: 14 }} onClick={() => setRange(shiftWeek(from, -1))}>‹</button>
        <button type="button" style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={() => setRange(weekRange(todayIn(timezone)))}>Сегодня</button>
        <button type="button" aria-label="Следующая неделя" style={{ ...btnGhost, padding: '4px 10px', fontSize: 14 }} onClick={() => setRange(shiftWeek(from, 1))}>›</button>
        <strong style={{ fontSize: 14, color: 'var(--text)', marginLeft: 'var(--space-4)' }}>{fmtWeekTitle(from, to)}</strong>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 10px' }}>
        Нажмите на время, чтобы закрыть или открыть его. Брони и встречи из календаря закрывают время сами.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-10)', marginBottom: 12 }}>
        {LEGEND_STATES.map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: 12, color: 'var(--text-faint)' }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 'var(--r-4)', ...chipStyles(s) }} />
            {stateLabel(s)}
          </span>
        ))}
      </div>

      {data?.calendarReadError && (
        <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 13, margin: '0 0 10px' }}>
          Занятость из календаря не прочиталась: {data.calendarReadError}. Встречи могли не показаться.
        </p>
      )}
      {data && data.calendarConnected && !data.calendarBlocking && (
        <p style={{ color: 'var(--text-faint)', fontSize: 12, margin: '0 0 10px' }}>
          Встречи из календаря видны, но запись поверх них открыта. Закрывайте их нажатием — или включите CALENDAR_BLOCK_SLOTS, чтобы это происходило само.
        </p>
      )}
      {mutateError && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 13, margin: '0 0 10px' }}>Не удалось сохранить: {mutateError}</p>}

      {failed && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 14 }}>Не удалось загрузить календарь — проверьте ключ или соединение.</p>}
      {!failed && data === null && <CalendarSkeleton />}
      {!failed && data && data.days.map((day) => (
        <DayCard key={day.date} day={day} timezone={timezone} today={today} pending={pending} onToggleCell={onToggleCell} onDayAction={onDayAction} />
      ))}
    </div>
  );
}

/** Силуэт недели: 7 карточек-дней, в каждой строка-заголовок + ряд плашек-чипов. */
function CalendarSkeleton() {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i}>
          <Skeleton width={120} height={16} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} width={64} height={44} radius={10} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
