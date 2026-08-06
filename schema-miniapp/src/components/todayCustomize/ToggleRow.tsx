import { pressable } from '../../utils/a11y';
import { Toggle } from '../settingsSheet/ui';

// Строка-тумблер листа «Настроить экран»: iOS-ряд внутри группы-карточки,
// свитч справа — тот же Toggle, что в settingsSheet/ui (правило «один
// компонент», не третья версия свитча). Клик/фокус — на строке (role=switch);
// Toggle внутри — inert + aria-hidden, второго tab-стопа и клика нет.
export function ToggleRow({
  emoji,
  title,
  sub,
  on,
  onToggle,
  highlighted = false,
  divider = false,
}: {
  emoji: string;
  title: string;
  sub: string;
  on: boolean;
  onToggle: () => void;
  highlighted?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      {...pressable(onToggle)}
      role="switch"
      aria-checked={on}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        cursor: 'pointer',
        borderTop: divider ? '1px solid rgba(var(--fg-rgb),0.05)' : undefined,
        background: highlighted
          ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
          : undefined,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>
      </div>
      <div aria-hidden inert style={{ pointerEvents: 'none' }}>
        <Toggle on={on} onClick={() => {}} />
      </div>
    </div>
  );
}
