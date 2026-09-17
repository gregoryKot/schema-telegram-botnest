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
        gap: 'var(--space-14)',
      }}
    >
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
