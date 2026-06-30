import { BottomSheet } from './BottomSheet';
import { NEED_DATA } from '../needData';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';

const NEED_COLORS: Record<string, string> = {
  attachment: '#ff6b9d',
  autonomy:   '#4fa3f7',
  expression: '#facc15',
  play:       '#06d6a0',
  limits:     '#a78bfa',
};

// Schema domains most associated with each core need (schema therapy theory)
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
  const need = NEED_DATA[needId];
  const color = NEED_COLORS[needId] ?? '#a78bfa';

  if (!need) return null;

  const level = childhoodRating !== undefined
    ? (childhoodRating <= 3 ? 'low' : childhoodRating <= 6 ? 'medium' : 'high')
    : null;

  // Childhood range description
  const rangeDesc = childhoodRating !== undefined
    ? (childhoodRating <= 3 ? need.ranges[0].description
      : childhoodRating <= 6 ? need.ranges[1].description
      : need.ranges[2].description)
    : null;

  // Related schemas from user's active list
  const domainIds = NEED_DOMAIN_MAP[needId] ?? [];
  const relatedSchemas = SCHEMA_DOMAINS
    .filter(d => domainIds.includes(d.id))
    .flatMap(d => d.schemas.filter(s => activeSchemaIds.includes(s.id)));

  const tips = level ? need.tips[level].slice(0, 3) : need.actions.slice(0, 3);

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
          }}>
            {need.emoji}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{need.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>{need.subtitle}</div>
          </div>
        </div>

        {/* Explanation */}
        <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.65, marginBottom: 16 }}>
          {need.explanation}
        </div>

        {/* Childhood score */}
        {childhoodRating !== undefined && (
          <div style={{
            background: `${color}10`, border: `1px solid ${color}25`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{childhoodRating}</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 3, letterSpacing: '0.04em' }}>детство</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, paddingTop: 2 }}>
              {rangeDesc}
            </div>
          </div>
        )}

        {/* Related schemas */}
        {relatedSchemas.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
              Связанные схемы
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {relatedSchemas.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 12,
                  background: `${color}08`, border: `1px solid ${color}15`,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{(s as any).emoji ?? '●'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips / Actions */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
            {level === 'low' ? 'Что поможет сейчас' : 'Практика'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                  background: `${color}18`, border: `1px solid ${color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.55 }}>{tip}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </BottomSheet>
  );
}
