// Ненавязчивая кнопочка шаринга: маленькая ghost-иконка со стрелкой.
// Ставится в хедеры/карточки; по тапу открывает ShareCardSheet.
interface Props {
  onClick: () => void;
  /** compact — только иконка 36×36; иначе иконка + подпись */
  label?: string;
}

const Icon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 15V4m0 0L8 8m4-4 4 4M6 13v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function SharePill({ onClick, label }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label ?? 'Поделиться'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 34,
        width: label ? undefined : 36,
        padding: label ? '0 12px' : 0,
        borderRadius: 10,
        border: 'none',
        background: 'rgba(var(--fg-rgb),0.07)',
        color: 'var(--text-sub)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <Icon />
      {label}
    </button>
  );
}
