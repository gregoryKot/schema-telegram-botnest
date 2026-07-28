import type { ReactNode } from 'react';

// Переиспользуемый чип-переключатель (эмоция/схема) — правило «одна механика
// — один компонент»: разметка была продублирована между EmotionsStep и
// SchemaChipsStep (jscpd-свип при распиле SchemaEntrySheet).
export function SelectableChip({
  label,
  selected,
  color,
  onClick,
  radius = 20,
  padding = '6px 12px',
  fontSize = 13,
}: {
  label: ReactNode;
  selected: boolean;
  /** цвет выделения (hex или css var) — из него строится фон/рамка */
  color: string;
  onClick: () => void;
  radius?: number;
  padding?: string;
  fontSize?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="sel-btn"
      style={{
        background: selected ? `${color}33` : 'rgba(var(--fg-rgb),0.06)',
        border: selected ? `1px solid ${color}` : '1px solid transparent',
        borderRadius: radius,
        padding,
        color: selected ? 'var(--chip-sel-text)' : 'rgba(var(--fg-rgb),0.6)',
        fontSize,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
