import { useHistorySheet } from '../../hooks/useHistorySheet';
import { Btn } from '../../components/landing-kit';
import { MOSS, TG_URL, NAV_LINKS, MOBILE_LINKS } from './constants';

// ─── Telegram link – quiet editorial text link (matches nav "Написать ↗") ────
export function TgLink({ label, size = 'sm', style }: { label: string; size?: 'lg' | 'sm'; style?: React.CSSProperties }) {
  const lg = size === 'lg';
  return (
    <a href={TG_URL} target="_blank" rel="noopener noreferrer" style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      fontSize: lg ? 15 : 14, fontWeight: 600, fontFamily: 'inherit',
      color: 'var(--text-sub)', textDecoration: 'none',
      transition: 'color .15s', ...style,
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}>
      <svg width={lg ? 16 : 14} height={lg ? 16 : 14} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ opacity: .7 }}><path d="M11.944 0A12 12 0 1 0 24 12 12 12 0 0 0 11.944 0ZM18.33 7.67l-2.3 10.84c-.165.73-.6.91-1.22.57l-3.36-2.47-1.62 1.56a.85.85 0 0 1-.68.33l.24-3.4 6.2-5.6c.27-.24-.06-.37-.41-.13L6.27 13.9 3 13.01c-.73-.2-.74-.73.15-1.08l13.93-5.37c.61-.22 1.14.15.95 1.11Z"/></svg>
      {label}
    </a>
  );
}

// ─── Section nav – compact desktop set ───────────────────────────────────────
export function SectionNav({ className, color = 'var(--text-sub)', active = '' }: { className?: string; color?: string; active?: string }) {
  return (
    <nav className={className} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {NAV_LINKS.map(l => {
        const isActive = active === l.href.slice(1);
        return (
          <a key={l.href} href={l.href}
            style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--accent)' : color, textDecoration: 'none', padding: '6px 10px', borderRadius: 8, whiteSpace: 'nowrap', transition: 'color .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isActive ? 'var(--accent)' : color; }}>
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}

// ─── Mobile menu – fullscreen overlay (uses useHistorySheet per project rule) ─
export function MobileMenu({ onClose, active, onBook }: { onClose: () => void; active: string; onBook: () => void }) {
  const goBack = useHistorySheet(onClose);
  const go = (href: string) => {
    if (href.startsWith('#')) {
      goBack();
      setTimeout(() => document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60);
    } else {
      // location.assign() navigates the same as `location.href = …` but is a
      // method call, not a property write react-compiler flags as a mutation.
      window.location.assign(href);
    }
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Меню" style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', padding: '20px 24px calc(28px + env(safe-area-inset-bottom,0px))',
      animation: 'menu-in .28s cubic-bezier(.16,1,.3,1) both',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--text)' }}>Меню</span>
        <button onClick={goBack} aria-label="Закрыть меню" style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {MOBILE_LINKS.map((l, i) => {
          const isActive = active === l.href.slice(1);
          return (
            <button key={l.href} onClick={() => go(l.href)} style={{
              textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
              padding: '16px 0', borderBottom: i === MOBILE_LINKS.length - 1 ? 'none' : '1px solid var(--line)',
              fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400,
              color: isActive ? 'var(--accent)' : 'var(--text)',
              fontStyle: isActive ? 'italic' : 'normal',
              display: 'flex', alignItems: 'center', gap: 12,
              animation: `menu-item-in .32s cubic-bezier(.16,1,.3,1) ${i * 35}ms both`,
            }}>
              {isActive && <span aria-hidden style={{ width: 3, height: 22, borderRadius: 2, background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />}
              {l.label}
            </button>
          );
        })}
      </nav>
      <div style={{ animation: `menu-item-in .32s cubic-bezier(.16,1,.3,1) ${MOBILE_LINKS.length * 35}ms both` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', marginBottom: 12, borderTop: '1px solid var(--line)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: MOSS, flexShrink: 0, display: 'inline-block', animation: 'pulse-dot 2.5s ease-in-out infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>Принимаю клиентов · </span>
          <a href={TG_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>@kotlarewski</a>
        </div>
        <Btn full size="lg" radius="btn" onClick={() => { goBack(); setTimeout(onBook, 60); }}>Записаться на знакомство →</Btn>
      </div>
    </div>
  );
}
