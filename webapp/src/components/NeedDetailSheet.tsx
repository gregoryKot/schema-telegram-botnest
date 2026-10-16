import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useNeedData } from '../needData';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { IdentityDot, needColor } from '../../../shared/src/components/IdentityDot';
import { useTr } from '../utils/addressForm';
import { NEED_HUE, hueStyle } from '../lib/tone';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tracker.css';

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
  const tr = useTr();
  const NEED_DATA = useNeedData();
  const need = NEED_DATA[needId];
  const color = needColor(needId);
  const hue = NEED_HUE[needId as NeedId];

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
    .flatMap(d => d.schemas.filter(s => activeSchemaIds.includes(s.id)).map(s => ({ ...s, domainColor: d.color })));

  const tips = level ? need.tips[level].slice(0, 3) : need.actions.slice(0, 3);

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow="Потребность"
      eyebrowColor={color}
      title={<>{need.name}<br /><span className="it">{need.subtitle}</span></>}
      lede={need.explanation}
      aside={
        childhoodRating !== undefined ? (
          <div className="ds-card tk2-aside" style={hueStyle(hue)}>
            <div className="ds-eyebrow tone-text">{tr('Твой балл в детстве', 'Ваш балл в детстве')}</div>
            <div className="tk2-aside-nums">
              <span className="ds-num tone-text">{childhoodRating}</span>
              <span className="tk2-aside-unit">из 10</span>
            </div>
            {rangeDesc && <p className="ds-sub" style={{ lineHeight: 1.65 }}>{rangeDesc}</p>}
            <div className="tk2-bars">
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < childhoodRating ? 'is-on' : ''} />
              ))}
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="tk2-opts" style={hueStyle(hue)}>
        {relatedSchemas.length > 0 && (
          <div className="ds-card ds-card--row">
            <div className="ds-label">Связанные схемы</div>
            <div className="tk2-opts">
              {relatedSchemas.map(s => (
                <div key={s.id} className="ds-card ds-card--row">
                  <div className="ds-h3 u-ac6"><IdentityDot color={s.domainColor} size={8} />{s.name}</div>
                  <div className="ds-sub">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ds-card">
          <div className="ds-label">{level === 'low' ? 'Что поможет сейчас' : 'Практика'}</div>
          <div className="tk2-tips">
            {tips.map((tip, i) => (
              <div key={i} className="tk2-tip">
                <div className="tk2-tip-n tone-tint">{i + 1}</div>
                <p>{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ExScreen>
  );
}
