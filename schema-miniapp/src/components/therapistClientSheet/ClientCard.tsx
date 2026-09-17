import { pressable } from '../../utils/a11y';
import { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { indexColor } from './helpers';
import { RosterSparkline } from '../../../../shared/src/components/Sparklines';

// Строка клиента в списке терапевта (аватар, активность, спарклайн индекса,
// индекс дня). Вынесено из ClientListView.tsx (правило №10).
export function ClientCard({
  client: c,
  today,
  onOpen,
}: {
  client: TherapyClientSummary;
  today: string;
  onOpen: (c: TherapyClientSummary) => void;
}) {
  const isToday = c.lastActiveDate === today;
  const isVirtual = c.telegramId < 0;
  const displayName =
    c.clientAlias ?? c.name ?? (isVirtual ? 'Оффлайн' : `ID ${c.telegramId}`);
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const avatarColors = [
    'var(--accent)',
    'var(--accent-blue)',
    'var(--accent-pink)',
    'var(--accent-green)',
    'var(--accent-orange)',
    'var(--accent-yellow)',
  ];
  const avatarColor =
    avatarColors[Math.abs(c.telegramId) % avatarColors.length];
  return (
    <div
      {...pressable(() => onOpen(c))}
      className="card"
      style={{
        borderRadius: 'var(--r-16)',
        padding: '14px 16px',
        marginBottom: 8,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-12)',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          flexShrink: 0,
          background: avatarColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 700,
          color: '#fff',
        }}
      >
        {initials || '?'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 2,
          }}
        >
          {displayName}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
          {isVirtual
            ? 'Без Telegram'
            : `${isToday ? 'Сегодня' : c.lastActiveDate ? fmtDate(c.lastActiveDate) : 'Не активен'} · Стрик ${c.streak} дн`}
        </div>
        {/* Динамика индекса за 14 дней (index 0 = сегодня →
                      разворачиваем). Меньше 2 точек — не занимаем место. */}
        {(c.recentIndexHistory ?? []).filter((v) => v != null).length >= 2 && (
          <RosterSparkline
            values={(c.recentIndexHistory ?? []).slice().reverse()}
          />
        )}
      </div>
      {c.todayIndex !== null && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: indexColor(c.todayIndex),
              lineHeight: 1,
            }}
          >
            {c.todayIndex.toFixed(1)}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: 2,
            }}
          >
            индекс
          </div>
        </div>
      )}
      <span
        style={{
          color: 'var(--text-faint)',
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        ›
      </span>
    </div>
  );
}
