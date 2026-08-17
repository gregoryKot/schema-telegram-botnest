import { pressable } from '../../utils/a11y';
import { Toggle } from '../settingsSheet/ui';

// Строка-тумблер листа «Настроить экран»: iOS-ряд внутри группы-карточки,
// свитч справа — тот же Toggle, что в settingsSheet/ui (правило «один
// компонент», не третья версия свитча). Клик/фокус — на строке (role=switch);
// Toggle внутри — inert + aria-hidden, второго tab-стопа и клика нет.
// Без эмодзи (фидбек владельца): в листах настройки выбирают по смыслу,
// названия + подписи достаточно — то же правило, что у строк меню «плюс».
// Без onToggle — строка-подпись без свитча (блок нельзя скрыть, только
// переставить: «Фокус дня» на «Сегодня»).
export function ToggleRow({
  title,
  sub,
  on,
  onToggle,
  highlighted = false,
  divider = false,
}: {
  title: string;
  sub: string;
  on?: boolean;
  onToggle?: () => void;
  highlighted?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      {...(onToggle ? pressable(onToggle) : {})}
      role={onToggle ? 'switch' : undefined}
      aria-checked={onToggle ? on : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        cursor: onToggle ? 'pointer' : undefined,
        borderTop: divider ? '1px solid rgba(var(--fg-rgb),0.05)' : undefined,
        background: highlighted
          ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
          : undefined,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{sub}</div>
      </div>
      {onToggle && (
        <div aria-hidden inert style={{ pointerEvents: 'none' }}>
          <Toggle on={!!on} onClick={() => {}} />
        </div>
      )}
    </div>
  );
}
