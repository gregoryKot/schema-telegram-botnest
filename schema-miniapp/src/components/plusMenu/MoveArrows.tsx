// Стрелки порядка (↑/↓) листа настройки — снаружи ToggleRow (не трогаем
// общий компонент, его использует и TodayCustomizeSheet). Каждая кнопка ≥44
// по обеим сторонам — цель нажатия, а не тумблер строки: stopPropagation,
// чтобы клик не долетал до её onToggle.
function ArrowButton({
  symbol,
  ariaLabel,
  disabled,
  onClick,
}: {
  symbol: string;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      style={{
        width: 44,
        minHeight: 44,
        flex: 1,
        border: 'none',
        background: 'transparent',
        color: disabled ? 'var(--text-faint)' : 'var(--text-sub)',
        fontSize: 16,
        cursor: disabled ? 'default' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {symbol}
    </button>
  );
}

export function MoveArrows({
  disabledUp,
  disabledDown,
  onUp,
  onDown,
}: {
  disabledUp: boolean;
  disabledDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
      <ArrowButton
        symbol="↑"
        ariaLabel="Выше"
        disabled={disabledUp}
        onClick={onUp}
      />
      <ArrowButton
        symbol="↓"
        ariaLabel="Ниже"
        disabled={disabledDown}
        onClick={onDown}
      />
    </div>
  );
}
