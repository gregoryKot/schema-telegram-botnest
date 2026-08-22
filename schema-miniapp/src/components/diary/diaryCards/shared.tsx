import { useState } from 'react';

// Общие хелперы карточек дневника. Вынесено из DiaryListView.tsx (правило №10).

/** color-mix helper: works with CSS variables AND hex strings */
export const cm = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export function formatDt(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  );
}

export function Field({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-sub)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(var(--fg-rgb),0.75)',
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </div>
  );
}

export function DeleteBtn({
  color,
  onClick,
}: {
  color: string;
  onClick: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        style={{
          marginTop: 8,
          background: cm(color, 13),
          border: 'none',
          borderRadius: 'var(--r-8)',
          padding: '6px 12px',
          color,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Удалить
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: 8 }}>
      <button
        onClick={onClick}
        style={{
          flex: 1,
          padding: '8px 0',
          borderRadius: 'var(--r-8)',
          border: 'none',
          background: 'rgba(239,68,68,0.15)',
          color: 'var(--accent-red)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Удалить навсегда
      </button>
      <button
        onClick={() => setConfirm(false)}
        style={{
          padding: '8px 14px',
          borderRadius: 'var(--r-8)',
          border: 'none',
          background: 'rgba(var(--fg-rgb),0.06)',
          color: 'var(--text-sub)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Отмена
      </button>
    </div>
  );
}
