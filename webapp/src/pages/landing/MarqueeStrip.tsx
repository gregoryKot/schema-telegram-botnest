import { TOPICS_A } from './constants';

// ─── Marquee strip – looping topic rail ──────────────────────────────────────
export function MarqueeStrip({ reverse = false, bg = 'var(--bg-rail)', italic = false, topics = TOPICS_A }: {
  reverse?: boolean; bg?: string; italic?: boolean; topics?: typeof TOPICS_A;
}) {
  const dur = reverse ? '40s' : '32s';
  const anim = reverse ? 'marquee-rev' : 'marquee-fwd';
  return (
    <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', overflow: 'hidden', padding: '14px 0', background: bg }}>
      <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>
        {[0, 1, 2].map(i => (
          <span key={i} aria-hidden={i > 0} style={{ display: 'inline-flex', flexShrink: 0, animation: `${anim} ${dur} linear infinite` }}>
            {topics.map(w => (
              <a key={w.label} href={w.href} tabIndex={i > 0 ? -1 : undefined}
                style={{ fontSize: 14, fontWeight: 500, fontStyle: italic ? 'italic' : 'normal', color: 'var(--text-sub)', padding: '8px 20px', textDecoration: 'none', transition: 'color .15s', display: 'inline-flex', alignItems: 'center' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-sub)'; }}>
                {w.label}<span style={{ color: 'var(--accent)', marginLeft: 20, fontStyle: 'normal' }}>·</span>
              </a>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
