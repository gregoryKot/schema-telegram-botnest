import { pressable } from '../../utils/a11y';

// ── Therapist cabinet banner ──────────────────────────────────────────────────

export function TherapistBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      {...pressable(onOpen)}
      className="card"
      style={{
        borderRadius: 18,
        padding: '12px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          flexShrink: 0,
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
        }}
      >
        🧑‍⚕️
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 2,
          }}
        >
          Кабинет терапевта
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          Клиенты · Задания · Концептуализация
        </div>
      </div>
      <span style={{ fontSize: 18, color: 'var(--text-faint)' }}>›</span>
    </div>
  );
}
