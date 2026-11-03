import type { CSSProperties, ReactNode } from 'react';

// Строка правки даты в карточке сессии: поля + «✓» + «✕». Начало терапии и
// следующая сессия раньше держали две копии этой разметки в SessionCard.
export const INLINE_FIELD_STYLE: CSSProperties = {
  background: 'rgba(var(--fg-rgb),0.07)',
  border: '1px solid rgba(var(--fg-rgb),0.15)',
  borderRadius: 'var(--r-8)',
  padding: '5px 8px',
  outline: 'none',
  color: 'var(--text)',
  fontSize: 13,
};

export function InlineEditRow({
  children,
  onSave,
  onCancel,
  saveDisabled,
  style,
}: {
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
        ...style,
      }}
    >
      {children}
      <button
        onClick={onSave}
        disabled={saveDisabled}
        aria-label="Сохранить"
        style={{
          padding: '5px 10px',
          borderRadius: 'var(--r-8)',
          border: 'none',
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        ✓
      </button>
      <button
        onClick={onCancel}
        aria-label="Отменить"
        style={{
          padding: '5px 8px',
          borderRadius: 'var(--r-8)',
          border: 'none',
          background: 'rgba(var(--fg-rgb),0.08)',
          color: 'var(--text-sub)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  );
}
