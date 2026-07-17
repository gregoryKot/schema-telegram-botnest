import type { TherapyClientSummary } from '../../api';
import { fmtDate } from '../../utils/format';
import { indexColor } from './helpers';
import type { AddMode } from '../therapist/useAddClient';

interface Props {
  loading: boolean;
  clients: TherapyClientSummary[];
  today: string;
  tr: (ty: string, vy: string) => string;
  openClient: (c: TherapyClientSummary) => void;
  openAddMode: (mode: AddMode) => void;
}

export function ClientListRows({
  loading,
  clients,
  today,
  tr,
  openClient,
  openAddMode,
}: Props) {
  return (
    <>
      {loading ? (
        <div
          style={{
            color: 'var(--text-sub)',
            fontSize: 14,
            textAlign: 'center',
            paddingTop: 40,
          }}
        >
          Загружаю...
        </div>
      ) : clients.length === 0 ? (
        <div
          style={{
            color: 'var(--text-sub)',
            fontSize: 14,
            textAlign: 'center',
            paddingTop: 20,
            lineHeight: 1.8,
          }}
        >
          Нет подключённых клиентов.
          <br />
          {tr('Нажми', 'Нажмите')}{' '}
          <strong style={{ color: 'var(--accent)' }}>+</strong> чтобы добавить.
        </div>
      ) : (
        clients.map((c) => {
          const isToday = c.lastActiveDate === today;
          const isVirtual = c.telegramId < 0;
          const displayName =
            c.clientAlias ??
            c.name ??
            (isVirtual ? 'Оффлайн' : `ID ${c.telegramId}`);
          const initials = displayName
            .split(' ')
            .map((w: string) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          const avatarColors = [
            '#a78bfa',
            '#60a5fa',
            '#f472b6',
            '#34d399',
            '#fb923c',
            '#facc15',
          ];
          const avatarColor =
            avatarColors[Math.abs(c.telegramId) % avatarColors.length];
          return (
            <div
              key={c.telegramId}
              onClick={() => openClient(c)}
              className="card"
              style={{
                borderRadius: 16,
                padding: '14px 16px',
                marginBottom: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
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
        })
      )}

      {/* Invite button */}
      {!loading && clients.length > 0 && (
        <div
          onClick={() => openAddMode('invite')}
          style={{
            border: '1px dashed rgba(var(--fg-rgb),0.18)',
            borderRadius: 16,
            padding: '14px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            color: 'var(--text-sub)',
            fontSize: 14,
          }}
        >
          + Пригласить клиента
        </div>
      )}
    </>
  );
}
