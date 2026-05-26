import { GlyphArrowLeft } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { NEED_DATA } from '../needData';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';

const NEED_COLORS: Record<string, string> = {
  attachment: '#ff6b9d',
  autonomy:   '#4fa3f7',
  expression: '#facc15',
  play:       '#06d6a0',
  limits:     '#a78bfa',
};

const NEED_DOMAIN_MAP: Record<string, string[]> = {
  attachment: ['rejection'],
  autonomy:   ['autonomy'],
  expression: ['other_directed', 'vigilance'],
  play:       ['vigilance'],
  limits:     ['limits'],
};

interface Props {
  needId: string;
  childhoodRating?: number;
  activeSchemaIds: string[];
  onClose: () => void;
}

export function NeedDetailSheet({ needId, childhoodRating, activeSchemaIds, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const need = NEED_DATA[needId];
  const color = NEED_COLORS[needId] ?? '#a78bfa';

  if (!need) return null;

  const level = childhoodRating !== undefined
    ? (childhoodRating <= 3 ? 'low' : childhoodRating <= 6 ? 'medium' : 'high')
    : null;

  const rangeDesc = childhoodRating !== undefined
    ? (childhoodRating <= 3 ? need.ranges[0].description
      : childhoodRating <= 6 ? need.ranges[1].description
      : need.ranges[2].description)
    : null;

  const domainIds = NEED_DOMAIN_MAP[needId] ?? [];
  const relatedSchemas = SCHEMA_DOMAINS
    .filter(d => domainIds.includes(d.id))
    .flatMap(d => d.schemas.filter(s => activeSchemaIds.includes(s.id)));

  const tips = level ? need.tips[level].slice(0, 3) : need.actions.slice(0, 3);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px' }}>
        <button className="ex-btn ex-btn-ghost" onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ fontSize: 52, marginBottom: 16 }}>{need.emoji}</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: 400, lineHeight: 1.1, color: 'var(--text)', marginBottom: 8 }}>
          {need.name}
        </h1>
        <div style={{ fontSize: 14, color, fontWeight: 600, marginBottom: 28, letterSpacing: '0.02em' }}>{need.subtitle}</div>

        {/* Explanation */}
        <p style={{ fontSize: 16, color: 'var(--text-sub)', lineHeight: 1.75, marginBottom: 36, borderLeft: `3px solid ${color}55`, paddingLeft: 20 }}>
          {need.explanation}
        </p>

        {/* Childhood score */}
        {childhoodRating !== undefined && (
          <div style={{ background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 20, padding: '24px', marginBottom: 36 }}>
            <div className="eyebrow" style={{ color, marginBottom: 16 }}>Твой балл в детстве</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 56, lineHeight: 1, color }}>{childhoodRating}</span>
              <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>из 10</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, margin: 0 }}>{rangeDesc}</p>
          </div>
        )}

        {/* Related schemas */}
        {relatedSchemas.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Связанные схемы</div>
            {relatedSchemas.map(s => (
              <div key={s.id} style={{
                padding: '14px 18px', borderRadius: 14, marginBottom: 8,
                background: `${color}06`, border: `1px solid ${color}18`,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{(s as any).emoji ?? '●'}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tips / Actions */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 20 }}>{level === 'low' ? 'Что поможет сейчас' : 'Практика'}</div>
          {tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: `${color}18`, border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--serif)', fontSize: 15, color,
              }}>
                {i + 1}
              </div>
              <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.65, margin: 0, paddingTop: 3 }}>{tip}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
