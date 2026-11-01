import { TherapyRelationInfo } from '../../api';
import { nextSessionLabel } from '../../../../shared/src/therapy/clientSheetHelpers';
import {
  isSessionToday,
  upcomingSession,
} from '../../../../shared/src/therapy/upcomingSession';

// Баннер «следующая встреча» для клиентов терапевта. Вынесено из
// HelpSection.tsx (правило №10, храповик размера файла).
export function NextSessionBanner({
  relation,
}: {
  relation: TherapyRelationInfo | null | undefined;
}) {
  if (relation?.role !== 'client') return null;
  // Прошедшая встреча — ближайший день встреч, без дней — баннера нет.
  const next = upcomingSession(relation.nextSession, relation.meetingDays);
  if (!next) return null;

  // Подпись — общая с карточкой терапевта («Пн, 26 мая · 10:00»; год — если
  // не текущий). «Сегодня» — местный день клиента: nextSession — настенное
  // время, а не день UTC (QA 2026-10-26).
  const label = nextSessionLabel(next);
  const isToday = isSessionToday(next);

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
