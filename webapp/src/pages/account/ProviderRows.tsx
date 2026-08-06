import type { ReactNode } from 'react';

// Строки способов входа в /account. Раньше Google, Telegram и ВКонтакте были
// тремя почти одинаковыми блоками разметки подряд — правка доезжала до одного
// и забывала два. Теперь строка одна, а различия — данные.
export type ProviderId = 'google' | 'telegram' | 'vk' | 'max' | 'email';

export interface AccountProvider {
  provider: ProviderId;
  email: string | null;
  displayName: string | null;
}

const iconBox = {
  width: 36,
  height: 36,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const btnGhost = {
  background: 'transparent',
  border: '1px solid rgba(var(--fg-rgb),0.15)',
  color: 'var(--text-sub)',
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
} as const;

const btnSolid = {
  background: 'var(--text)',
  border: 'none',
  color: 'var(--bg)',
  borderRadius: 6,
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

export function ProviderRow({
  icon,
  title,
  subtitle,
  emptySubtitle,
  linked,
  busy,
  onLink,
  onUnlink,
  note,
  divider,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  /** Подпись, когда способ входа НЕ привязан («не привязан»). */
  emptySubtitle?: string;
  linked: boolean;
  busy: boolean;
  onLink?: () => void;
  onUnlink?: () => void;
  /** Текст вместо кнопки — когда привязать отсюда нельзя. */
  note?: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 0',
        ...(divider
          ? { borderBottom: '1px solid rgba(var(--fg-rgb),0.07)' }
          : {}),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {icon}
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
          {linked && subtitle && (
            <div style={{ color: 'var(--text-sub)', fontSize: 12 }}>
              {subtitle}
            </div>
          )}
          {!linked && emptySubtitle && (
            <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>
              {emptySubtitle}
            </div>
          )}
        </div>
      </div>
      {linked && onUnlink ? (
        <button disabled={busy} onClick={onUnlink} style={btnGhost}>
          Отвязать
        </button>
      ) : onLink ? (
        <button disabled={busy} onClick={onLink} style={btnSolid}>
          Привязать
        </button>
      ) : (
        <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{note}</span>
      )}
    </div>
  );
}

export function GoogleIcon() {
  return (
  <div style={{ ...iconBox, background: 'rgba(var(--fg-rgb),0.04)' }}>
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  </div>
  );
}

export function TelegramIcon() {
  return (
  <div style={{ ...iconBox, background: 'rgba(34,158,217,0.12)' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.93 6.89l-1.68 7.92c-.12.56-.45.7-.9.43l-2.5-1.84-1.2 1.16c-.13.13-.25.25-.5.25l.18-2.55 4.63-4.18c.2-.18-.04-.27-.31-.1l-5.72 3.6-2.46-.77c-.54-.17-.55-.54.11-.8l9.58-3.69c.45-.16.85.11.69.77z" fill="#2AABEE" />
    </svg>
  </div>
  );
}

export function VkIcon() {
  return (
  <div style={{ ...iconBox, background: '#0077FF', color: 'white', fontSize: 14, fontWeight: 600 }}>
    VK
  </div>
  );
}

export function MaxIcon() {
  return (
  <div style={{ ...iconBox, background: 'rgba(var(--fg-rgb),0.06)', fontSize: 13, fontWeight: 700 }}>
    MAX
  </div>
  );
}

export function EmailIcon() {
  return (
    <div
      style={{
        ...iconBox,
        background: 'rgba(var(--fg-rgb),0.06)',
        color: 'var(--text-sub)',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    </div>
  );
}
