// Общий чекбокс шагов Disclaimer. Перенесено из Disclaimer.tsx как есть
// (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function DisclaimerCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        cursor: 'pointer',
        marginBottom: 12,
      }}
    >
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          flexShrink: 0,
          marginTop: 1,
          border: `2px solid ${checked ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.2)'}`,
          background: checked ? 'var(--accent)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {checked && (
          <span
            style={{ fontSize: 11, color: 'var(--on-accent)', fontWeight: 700 }}
          >
            ✓
          </span>
        )}
      </div>
      <span
        role="presentation"
        onClick={onToggle}
        style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}
      >
        {label}
      </span>
    </label>
  );
}
