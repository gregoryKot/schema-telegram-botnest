import { useState } from 'react';
import type { ArticleSummary } from '../../api';
import { GLASS, GLASS_BORDER, INK, SUB, FAINT, VIOLET, AURORA, glow } from './aurora';
import { FAQ } from './productContent';

// Карточки продуктового лендинга (стекло-карточка, карточка статьи, FAQ).
// Вынесены из ProductLandingPage при добавлении блока об авторе (файловый
// храповик). Данные — в productContent.tsx (react-refresh: раздельно).

// ─── Стекло-карточка (иконка + заголовок + текст) ────────────────────────────
export function GlassCard({ emoji, color, title, children, big }: { emoji: string; color: string; title: string; children: React.ReactNode; big?: boolean }) {
  return (
    <div className="pl2-card" style={{
      position: 'relative', background: GLASS, border: `1px solid ${GLASS_BORDER}`, borderRadius: 22,
      padding: big ? '28px 24px' : '24px 22px', overflow: 'hidden',
      transition: 'transform .25s, border-color .25s, box-shadow .25s',
    }}>
      <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: glow(color, .16), filter: 'blur(30px)', pointerEvents: 'none' }} />
      <span style={{ position: 'relative', width: 48, height: 48, borderRadius: 14, fontSize: 23, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: glow(color, .14), border: `1px solid ${glow(color, .3)}`, boxShadow: `0 0 20px ${glow(color, .15)}` }}>{emoji}</span>
      <p style={{ position: 'relative', fontSize: big ? 19 : 17, fontWeight: 800, letterSpacing: '-.02em', margin: '14px 0 8px', color: INK }}>{title}</p>
      <p style={{ position: 'relative', fontSize: 14, lineHeight: 1.65, margin: 0, color: SUB }}>{children}</p>
    </div>
  );
}

// ─── Карточка статьи ──────────────────────────────────────────────────────────
export function ArticleCard({ a }: { a: ArticleSummary }) {
  return (
    <a className="pl2-card" href={`/articles/${a.slug}`} style={{
      display: 'flex', flexDirection: 'column', textDecoration: 'none',
      background: GLASS, border: `1px solid ${GLASS_BORDER}`, borderRadius: 20, overflow: 'hidden',
      transition: 'transform .25s, border-color .25s, box-shadow .25s',
    }}>
      <div style={{ aspectRatio: '16 / 9', background: AURORA, overflow: 'hidden', opacity: a.heroImage ? 1 : 0.5 }}>
        {a.heroImage && <img src={a.heroImage} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </div>
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.25, margin: 0, color: INK }}>{a.title}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0, color: SUB, flex: 1 }}>{a.description}</p>
        <span style={{ fontSize: 12, color: FAINT, marginTop: 4 }}>{new Date(a.date).toLocaleDateString('ru', { day: 'numeric', month: 'long' })} · {a.readMin} мин</span>
      </div>
    </a>
  );
}

export function FaqList() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ background: GLASS, border: `1px solid ${isOpen ? glow(VIOLET, .4) : GLASS_BORDER}`, borderRadius: 16, overflow: 'hidden', transition: 'border-color .2s' }}>
            <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: INK, lineHeight: 1.4, fontFamily: 'inherit' }}>{item.q}</span>
              <span style={{ fontSize: 22, color: VIOLET, flexShrink: 0, lineHeight: 1, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .25s' }}>+</span>
            </button>
            <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows .3s ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: 14.5, lineHeight: 1.75, color: SUB, margin: '0 20px 20px' }}>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
