function SectionHeader({
  children,
  onInfo,
}: {
  children: React.ReactNode;
  onInfo?: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        paddingTop: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-sub)',
        }}
      >
        {children}
      </div>
      {onInfo && (
        <button
          onClick={onInfo}
          aria-label="Пояснение"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'rgba(var(--fg-rgb),0.08)',
            color: 'var(--text-faint)',
            fontSize: 9,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            flexShrink: 0,
            padding: 0,
          }}
        >
          ?
        </button>
      )}
    </div>
  );
}

export { SectionHeader };

export const SettingsLabel = ({ children }: { children: React.ReactNode }) => (
  <SectionHeader>{children}</SectionHeader>
);

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        flexShrink: 0,
        background: on ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)',
        position: 'relative',
        transition: 'background 0.2s',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--bg)',
          transition: 'left 0.2s',
        }}
      />
    </div>
  );
}

export function RowRight({ text, small }: { text: string; small?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          fontSize: small ? 13 : 15,
          color: 'var(--text-sub)',
          textAlign: 'right',
          maxWidth: 160,
        }}
      >
        {text}
      </span>
      <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>›</span>
    </div>
  );
}

export function Row({
  label,
  sub,
  emoji,
  right,
  onClick,
  divider,
  color,
}: {
  label: string;
  sub?: string;
  emoji?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  divider?: boolean;
  color?: string;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 16px',
        cursor: onClick ? 'pointer' : 'default',
        borderTop: divider ? '1px solid rgba(var(--fg-rgb),0.05)' : undefined,
      }}
    >
      {emoji && (
        <span
          style={{
            fontSize: 18,
            width: 26,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          {emoji}
        </span>
      )}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: color ?? 'var(--text)',
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}
          >
            {sub}
          </div>
        )}
      </div>
      {right ??
        (onClick && (
          <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>›</span>
        ))}
    </div>
  );
}
