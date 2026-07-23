// Логотип и CTA-кнопка продуктового бренда — общие для маркетинговых страниц
// app-домена (ProductLandingPage, /tests). Одна механика — один компонент:
// раньше жили внутри ProductLandingPage, вынесены при добавлении мини-тестов.
import { INK, AURORA, GLASS_BORDER, VIOLET, PINK, glow } from './aurora';

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: size, height: size, borderRadius: size * 0.32, flexShrink: 0,
        background: AURORA, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.55, boxShadow: `0 0 22px ${glow(PINK, .5)}`,
      }}>🧠</span>
      <span style={{ fontSize: 16.5, fontWeight: 800, color: INK, letterSpacing: '-.02em' }}>Всё по схеме</span>
    </span>
  );
}

export function Cta({ href, children, variant = 'primary', size = 'md' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'ghost'; size?: 'md' | 'lg' }) {
  const pad = size === 'lg' ? '15px 30px' : '11px 22px';
  const fs = size === 'lg' ? 15 : 13.5;
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: pad, fontSize: fs, fontWeight: 700, fontFamily: 'inherit', borderRadius: 14,
    textDecoration: 'none', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s, background .15s',
    border: '1px solid transparent', boxSizing: 'border-box',
  };
  const styles: React.CSSProperties = variant === 'primary'
    ? { ...base, background: AURORA, color: '#1a0f2e', boxShadow: `0 8px 30px ${glow(VIOLET, .45)}` }
    : { ...base, background: 'rgba(255,255,255,.04)', color: INK, borderColor: GLASS_BORDER };
  const ext = href.startsWith('http');
  return (
    <a href={href} target={ext ? '_blank' : undefined} rel={ext ? 'noopener noreferrer' : undefined} style={styles}
      onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = 'translateY(-2px)'; if (variant === 'primary') el.style.boxShadow = `0 14px 44px ${glow(PINK, .55)}`; else el.style.background = 'rgba(255,255,255,.09)'; }}
      onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = ''; if (variant === 'primary') el.style.boxShadow = `0 8px 30px ${glow(VIOLET, .45)}`; else el.style.background = 'rgba(255,255,255,.04)'; }}>
      {children}
    </a>
  );
}
