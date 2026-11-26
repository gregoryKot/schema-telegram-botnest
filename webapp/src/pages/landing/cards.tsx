import { useId, useState } from 'react';
import { FAQ_ITEMS } from './constants';
import { faqAnswer } from './faqAnswer';
// ─── Approach rows: строка на бумаге под тонкой линией, номер — акцентом ─────
export function BentoCard({ num, title, text }: { num: string; title: string; text: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: 'var(--accent)' }}>{num}</span>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 23, fontWeight: 400, lineHeight: 1.2, margin: 0, color: 'var(--text)' }}>{title}</h3>
      <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: 'var(--text-sub)', maxWidth: '65ch' }}>{text}</p>
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
              {/* Знак без круга: тап-цель — вся строка-кнопка. */}
              <span aria-hidden style={{
                flexShrink: 0, fontSize: 24, fontWeight: 300, lineHeight: 1,
                color: isOpen ? 'var(--accent)' : 'var(--text-sub)',
                transition: 'color .2s, transform .2s',
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
