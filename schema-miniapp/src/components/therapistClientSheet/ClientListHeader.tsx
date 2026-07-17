import type { TherapyClientSummary } from '../../api';
import type { AddMode } from '../therapist/useAddClient';

interface Props {
  onClose: () => void;
  addMode: AddMode;
  openAddMode: (mode: AddMode) => void;
  loading: boolean;
  clients: TherapyClientSummary[];
  today: string;
}

export function ClientListHeader({
  onClose,
  addMode,
  openAddMode,
  loading,
  clients,
  today,
}: Props) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-0.5px',
              }}
            >
              Кабинет
            </div>
            <div
              style={{
                background:
                  'color-mix(in srgb, var(--accent) 20%, transparent)',
                border:
                  '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                borderRadius: 20,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--accent)',
                letterSpacing: '0.03em',
              }}
            >
              психолог
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.4,
            }}
          >
            Клиенты · Задания · Концептуализация
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {/* Exit therapist mode — always visible escape hatch */}
          <button
            onClick={onClose}
            title="Вернуться в приложение"
            aria-label="Вернуться в приложение"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              background: 'rgba(var(--fg-rgb),0.07)',
              color: 'var(--text-faint)',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
          <button
            onClick={() => openAddMode(addMode ? null : 'invite')}
            aria-label={addMode ? 'Закрыть' : 'Добавить клиента'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              background: addMode
                ? 'rgba(var(--fg-rgb),0.08)'
                : 'color-mix(in srgb, var(--accent) 20%, transparent)',
              color: addMode ? 'rgba(var(--fg-rgb),0.5)' : 'var(--accent)',
              fontSize: addMode ? 18 : 22,
              fontWeight: 300,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            {addMode ? '✕' : '+'}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {!loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            marginBottom: 20,
          }}
        >
          {[
            { value: clients.length, label: 'КЛИЕНТОВ' },
            {
              value: clients.filter((c) => c.lastActiveDate === today).length,
              label: 'АКТИВНЫХ',
            },
            {
              value: clients.filter((c) => c.todayIndex !== null).length,
              label: 'ОЦЕНИЛИ',
            },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="card"
              style={{
                borderRadius: 16,
                padding: '14px 12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'var(--text)',
                  lineHeight: 1,
                  letterSpacing: '-0.5px',
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--text-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginTop: 4,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
