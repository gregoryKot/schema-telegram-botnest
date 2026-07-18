// Аккуратная, но ЗАМЕТНАЯ кнопка «Поделиться»: иконка-стрелка + подпись.
// Лёгкий акцентный фон, чтобы её было видно и понятно, что это шэр (а не
// просто серый значок). Цель ≥ 44px по высоте (тач-таргет).
interface Props {
  onClick: () => void;
  /** Подпись рядом с иконкой; по умолчанию «Поделиться» */
  label?: string;
  /** compact — только иконка (для тесных мест), но всё равно акцентная */
  compact?: boolean;
}

const Icon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 15V4m0 0L8 8m4-4 4 4M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function SharePill({ onClick, label, compact }: Props) {
  const text = label ?? 'Поделиться';
  return (
    <button
      onClick={onClick}
      aria-label={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        minHeight: 40,
        width: compact ? 40 : undefined,
        padding: compact ? 0 : '0 16px',
        borderRadius: 12,
        border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        color: 'var(--accent)',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Icon />
      {!compact && text}
    </button>
  );
}
