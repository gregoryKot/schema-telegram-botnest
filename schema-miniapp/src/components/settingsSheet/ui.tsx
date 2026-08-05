import { type ReactNode } from 'react';

export function SectionHeader({
  children,
  onInfo,
}: {
  children: ReactNode;
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

export const SettingsLabel = ({ children }: { children: ReactNode }) => (
  <SectionHeader>{children}</SectionHeader>
);

// Иконка темы — язык SVG как в BottomNav (24×24, stroke currentColor).
// Контрол переключения — соседний Toggle; эта иконка сопровождает подпись
// «Тёмная/Светлая тема», поэтому aria-label декоративно дублирует текст.
export function ThemeIcon({ theme }: { theme: 'light' | 'dark' }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    color: 'var(--text-sub)',
  };
  if (theme === 'dark') {
    return (
      <svg {...common} role="img" aria-label="Тёмная тема">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
      </svg>
    );
  }
  return (
    <svg {...common} role="img" aria-label="Светлая тема">
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="1.5" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22.5" />
      <line x1="1.5" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22.5" y2="12" />
      <line x1="4.4" y1="4.4" x2="6.1" y2="6.1" />
      <line x1="17.9" y1="17.9" x2="19.6" y2="19.6" />
      <line x1="4.4" y1="19.6" x2="6.1" y2="17.9" />
      <line x1="17.9" y1="6.1" x2="19.6" y2="4.4" />
    </svg>
  );
}

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
  right,
  onClick,
  divider,
  color,
}: {
  label: string;
  sub?: string;
  right?: ReactNode;
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
