import { R, INK_ON_DARK } from './landing-kit-hooks';

// Shared component primitives for landing pages (LandingPage — терапевт,
// ProductLandingPage — продукт). Tokens/hooks live in ./landing-kit-hooks.

// ─── Button – single source for all CTAs ─────────────────────────────────────
type BtnVariant = 'primary' | 'ghost' | 'dark';
type BtnSize = 'sm' | 'md' | 'lg';
const BTN_PAD: Record<BtnSize, string> = { sm: '8px 18px', md: '13px 24px', lg: '15px 30px' };
const BTN_FS:  Record<BtnSize, number> = { sm: 13, md: 14, lg: 15 };

export function Btn({
  children, variant = 'primary', size = 'md', radius = 'pill',
  href, onClick, type = 'button', full = false, disabled = false, style, newTab,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  radius?: 'pill' | 'btn';
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  full?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  /** Override new-tab behaviour. Defaults to true for http links, false for relative. */
  newTab?: boolean;
}) {
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 28px rgba(77,71,153,.28)' },
    ghost:   { background: 'transparent', borderColor: 'var(--line-strong)', color: 'var(--text-sub)', fontWeight: 500 },
    dark:    { background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.2)', color: INK_ON_DARK },
  };
  const css: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: BTN_PAD[size], fontSize: BTN_FS[size], fontWeight: 700, fontFamily: 'inherit',
    borderRadius: radius === 'pill' ? R.pill : R.btn,
    border: '1.5px solid transparent', boxSizing: 'border-box',
    cursor: disabled ? 'default' : 'pointer', textDecoration: 'none',
    width: full ? '100%' : undefined, opacity: disabled ? 0.4 : 1,
    transition: 'transform .15s, box-shadow .15s, background .15s, border-color .15s, color .15s',
    ...variants[variant], ...style,
  };
  const enter = (e: React.MouseEvent) => {
    if (disabled) return;
    const el = e.currentTarget as HTMLElement;
    if (variant === 'primary') { el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 40px rgba(77,71,153,.4)'; }
    else if (variant === 'ghost') { el.style.borderColor = 'var(--text)'; el.style.color = 'var(--text)'; }
    else { el.style.background = 'rgba(255,255,255,.18)'; }
  };
  const leave = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.transform = '';
    el.style.boxShadow = variant === 'primary' ? '0 8px 28px rgba(77,71,153,.28)' : '';
    if (variant === 'ghost') { el.style.borderColor = 'var(--line-strong)'; el.style.color = 'var(--text-sub)'; }
    if (variant === 'dark') { el.style.background = 'rgba(255,255,255,.1)'; }
  };
  if (href) {
    const ext = href.startsWith('http');
    const openNewTab = newTab !== undefined ? newTab : ext;
    return <a href={href} target={openNewTab ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined}
      style={css} onMouseEnter={enter} onMouseLeave={leave}>{children}</a>;
  }
  return <button type={type} onClick={onClick} disabled={disabled} style={css} onMouseEnter={enter} onMouseLeave={leave}>{children}</button>;
}

// ─── Theme toggle icon – crisp sun/moon (no unicode glyph rendering issues) ──
export function ThemeIcon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
