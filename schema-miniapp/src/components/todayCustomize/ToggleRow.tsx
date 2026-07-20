import { pressable } from '../../utils/a11y';

// Строка-тумблер листа «Настроить экран»: показывать блок или нет.
// Вынесена из TodayCustomizeSheet (правило №10: файл дробится, а не пухнет).
export function ToggleRow({
  emoji,
  title,
  sub,
  on,
  onToggle,
  highlighted = false,
}: {
  emoji: string;
  title: string;
  sub: string;
  on: boolean;
  onToggle: () => void;
  highlighted?: boolean;
}) {
  return (
    <div
      {...pressable(onToggle)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 14,
        cursor: 'pointer',
        background: highlighted
          ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
          : 'rgba(var(--fg-rgb),0.04)',
        border: `1.5px solid ${
          highlighted
            ? 'color-mix(in srgb, var(--accent) 35%, transparent)'
            : 'transparent'
        }`,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}>
          {sub}
        </div>
      </div>
      <span
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: on ? 'var(--accent)' : 'var(--text-faint)',
        }}
      >
        {on ? '✓' : '—'}
      </span>
    </div>
  );
}
