// Кнопка «настроить список» рядом с заголовком (меню «плюс», «Инструменты»).
// Голый текст кнопкой не читается — аффорданс: мягкий фон, скругление 999,
// цель ≥44. Одна механика — один компонент: обе поверхности берут её отсюда.
export function CustomizeButton({
  label,
  ariaLabel,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        minHeight: 44,
        padding: '6px 12px',
        borderRadius: 999,
        border: 'none',
        flexShrink: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: 'var(--accent)',
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
        display: 'flex',
        alignItems: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
}
