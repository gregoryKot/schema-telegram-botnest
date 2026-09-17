import type { BeliefEntry } from './storage';

// Список прошлых проверок под первым шагом. Вынесено из BeliefCheck.tsx
// (правило №10).
export function HistoryList({ history }: { history: BeliefEntry[] }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 10,
        }}
      >
        Прошлые проверки
      </div>
      {history.map((h) => (
        <div
          key={h.id}
          style={{
            padding: '10px 14px',
            background: 'rgba(var(--fg-rgb),0.03)',
            border: '1px solid rgba(var(--fg-rgb),0.06)',
            borderRadius: 'var(--r-12)',
            marginBottom: 7,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              marginBottom: 3,
            }}
          >
            {h.date}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.4,
            }}
          >
            «{h.belief}»
          </div>
        </div>
      ))}
    </div>
  );
}
