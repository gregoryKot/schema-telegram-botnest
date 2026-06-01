import { ExScreen } from './exercises/ExScreen';
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
    ? (childhoodRating <= 3 ? need.ranges[0].description : childhoodRating <= 6 ? need.ranges[1].description : need.ranges[2].description)
    : null;

  const domainIds = NEED_DOMAIN_MAP[needId] ?? [];
  const relatedSchemas = SCHEMA_DOMAINS
    .filter(d => domainIds.includes(d.id))
    .flatMap(d => d.schemas.filter(s => activeSchemaIds.includes(s.id)));

  const tips = level ? need.tips[level].slice(0, 3) : need.actions.slice(0, 3);

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow={`${need.emoji} Потребность`}
      eyebrowColor={color}
      title={<>{need.name}<br /><span className="it">{need.subtitle}</span></>}
      lede={need.explanation}
      aside={
        childhoodRating !== undefined ? (
          <div className="aside-card" style={{ borderColor: `${color}40`, background: `${color}08`, position: 'sticky', top: 40 }}>
            <div className="aside-card-eyebrow" style={{ color }}>Твой балл в детстве</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 56, lineHeight: 1, color }}>{childhoodRating}</span>
              <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>из 10</span>
            </div>
            {rangeDesc && (
              <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.65 }}>{rangeDesc}</p>
            )}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color}22` }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {[...Array(10)].map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < childhoodRating ? color : `${color}20` }} />
                ))}
              </div>
            </div>
          </div>
        ) : undefined
      }
    >
      {/* Related schemas */}
      {relatedSchemas.length > 0 && (
        <div className="prompt">
          <div className="prompt-num">·</div>
          <div style={{ width: '100%' }}>
            <div className="prompt-label">Связанные схемы</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {relatedSchemas.map(s => (
                <div key={s.id} className="mode-card" style={{ '--mode-color': color } as React.CSSProperties}>
                  <span className="mode-card-stripe" />
                  <div>
                    <div className="mode-card-name">{(s as any).emoji ?? '●'} {s.name}</div>
                    <div className="mode-card-short">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="prompt">
        <div className="prompt-num">·</div>
        <div>
          <div className="prompt-label">{level === 'low' ? 'Что поможет сейчас' : 'Практика'}</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 16 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: `${color}18`, border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--serif)', fontSize: 15, color,
                }}>
                  {i + 1}
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.65, paddingTop: 3 }}>{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ExScreen>
  );
}
