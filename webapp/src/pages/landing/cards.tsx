import { useState } from 'react';
import { useTilt } from '../../components/landing-kit-hooks';
import { APP_FEATURES, FAQ_ITEMS } from './constants';

// ─── App feature card (needs own component for useTilt hook) ─────────────────
export function AppFeatureCard({ f, accent }: { f: typeof APP_FEATURES[0]; accent: boolean }) {
  const ref = useTilt();
  return (
    <div ref={ref} style={{ background: accent ? 'var(--accent)' : 'var(--bg-elev)', border: accent ? 'none' : '1px solid var(--line)', borderRadius: 16, padding: '22px 18px', display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default', transition: 'transform .25s, box-shadow .25s', willChange: 'transform' }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: accent ? 'rgba(255,255,255,.6)' : 'var(--accent)' }}>{f.num}</span>
      <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: accent ? 'white' : 'var(--text)' }}>{f.title}</p>
      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: accent ? 'rgba(255,255,255,.78)' : 'var(--text-sub)' }}>{f.text}</p>
    </div>
  );
}

// ─── Approach cards ───────────────────────────────────────────────────────────
export function BentoCard({ num, title, text, accent = false }: { num: string; title: string; text: string; accent?: boolean }) {
  const ref = useTilt();
  return (
    <div ref={ref} style={{
      background: accent ? 'var(--accent)' : 'var(--bg-elev)',
      border: accent ? 'none' : '1px solid var(--line)',
      color: accent ? 'white' : undefined,
      borderRadius: 20, padding: '32px',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'transform .25s, box-shadow .25s',
      cursor: 'default', willChange: 'transform',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', opacity: accent ? .65 : 1, color: accent ? 'white' : 'var(--text-faint)' }}>{num}</span>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: accent ? 28 : 21, fontWeight: 400, lineHeight: 1.2, margin: 0, color: accent ? 'white' : 'var(--text)', whiteSpace: 'pre-line' }}>{title}</h3>
      <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, opacity: accent ? .85 : 1, color: accent ? 'white' : 'var(--text-sub)' }}>{text}</p>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
export function FaqList({ price }: { price: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ borderTop: '1px solid var(--line)', borderBottom: i === FAQ_ITEMS.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 16, padding: '22px 0', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', transition: 'opacity .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '.8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{item.q}</span>
              <span style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                background: isOpen ? 'var(--accent)' : 'rgba(var(--fg-rgb),.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: isOpen ? 'white' : 'var(--text-sub)',
                transition: 'background .2s, transform .2s',
                transform: isOpen ? 'rotate(45deg)' : 'none',
              }}>+</span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .32s ease', overflow: 'hidden' }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 22px', maxWidth: 660 }}>
                  {item.a.replace('{PRICE}', price)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
