import { TherapyRelationInfo } from '../../api';
import { todayCalendarDate } from '../../../../shared/src/utils/calendarDate';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';

const MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];
const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Баннер «следующая встреча» для клиентов терапевта. Вынесено из
// HelpSection.tsx (правило №10, храповик размера файла). Поведение не менялось.
export function NextSessionBanner({
  relation,
}: {
  relation: TherapyRelationInfo | null | undefined;
}) {
  if (relation?.role !== 'client') return null;
  // Прошедшая встреча — ближайший день встреч, без дней — баннера нет.
  const next = upcomingSession(relation.nextSession, relation.meetingDays);
  if (!next) return null;

  const [datePart, timePart] = next.includes('T')
    ? next.split('T')
    : [next, null];
  const [y, m, d] = datePart.split('-').map(Number);
  const label = `${DAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]}${timePart ? ` · ${timePart}` : ''}`;
  const isToday = datePart === todayCalendarDate();

  return (
    <div
      style={{
        marginTop: 10,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: isToday
          ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
          : 'rgba(var(--fg-rgb),0.05)',
        border: `1px solid ${isToday ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`,
        borderRadius: 'var(--r-20)',
        padding: '5px 12px',
      }}
    >
      <span style={{ fontSize: 13 }}>📅</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: isToday ? 'var(--accent-green)' : 'rgba(var(--fg-rgb),0.6)',
        }}
      >
        {isToday ? 'Сегодня встреча' : `Встреча: ${label}`}
      </span>
      {relation.partnerName && (
        <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>
          с {relation.partnerName}
        </span>
      )}
    </div>
  );
}
