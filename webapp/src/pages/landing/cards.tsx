import { useId, useState } from 'react';
import { FAQ_ITEMS } from './constants';
import { faqAnswer } from './faqAnswer';
// ─── Approach cards ───────────────────────────────────────────────────────────
export function BentoCard({ num, title, text, accent = false }: { num: string; title: string; text: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'var(--accent)' : 'var(--bg-elev)',
      border: accent ? 'none' : '1px solid var(--line)',
      color: accent ? 'var(--on-accent)' : undefined,
      borderRadius: 'var(--r-20)', padding: '32px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', opacity: accent ? .65 : 1, color: accent ? 'var(--on-accent)' : 'var(--text-faint)' }}>{num}</span>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: accent ? 28 : 21, fontWeight: 400, lineHeight: 1.2, margin: 0, color: accent ? 'var(--on-accent)' : 'var(--text)', whiteSpace: 'pre-line' }}>{title}</h3>
      <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, opacity: accent ? .85 : 1, color: accent ? 'var(--on-accent)' : 'var(--text-sub)' }}>{text}</p>
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
export function FaqList({ price, online = true }: { price: string; online?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-faq-${i}`;
        return (
          <div key={i} style={{ borderTop: '1px solid var(--line)', borderBottom: i === FAQ_ITEMS.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <button
              aria-expanded={isOpen} aria-controls={panelId}
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
                fontSize: 18, color: isOpen ? 'var(--on-accent)' : 'var(--text-sub)',
                transition: 'background .2s, transform .2s',
                transform: isOpen ? 'rotate(45deg)' : 'none',
              }}>+</span>
            </button>
            {/* Свёрнутая панель: aria-hidden + inert (React 19 — булев проп): ни скринридера, ни фокуса. */}
            <div id={panelId} aria-hidden={!isOpen} inert={!isOpen} style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .32s ease', overflow: 'hidden' }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.8, margin: '0 0 22px', maxWidth: 660 }}>
                  {faqAnswer(item.a, price, online)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
