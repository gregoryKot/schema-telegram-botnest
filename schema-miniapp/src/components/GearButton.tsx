import { GearIcon } from './GearIcon';

// Единственная кнопка-шестерёнка «настроить экран» — раньше жила инлайном
// в TodaySection (44×44, border var(--border-color), surface), теперь общий
// компонент: «Паттерны» и «Здесь и сейчас» берут её же, а не копируют
// разметку (правило «одна механика — один компонент», CLAUDE.md).
export function GearButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 44,
        height: 44,
        borderRadius: 'var(--r-14)',
        border: '1px solid var(--border-color)',
        background: 'var(--surface)',
        color: 'var(--text-sub)',
        fontSize: 17,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <GearIcon />
    </button>
  );
}
