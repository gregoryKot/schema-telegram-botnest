import type { CSSProperties } from 'react';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useNeedData } from '../needData';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { useTr } from '../utils/addressForm';
import { needLook } from '../../../shared/src/theme/entityLook';
import type { NeedId } from '../../../shared/src/needs/types';
import { glue } from '../../../shared/src/utils/typo';
import { inkVars } from './history/needInk';
import { DomainMark } from './DomainMark';
import { TipHead } from './schemaSheets/TipHead';
import '../styles/sheet-tracker.css';

const NEED_DOMAIN_MAP: Record<string, string[]> = {
  attachment: ['rejection'], autonomy: ['autonomy'], expression: ['other_directed', 'vigilance'], play: ['vigilance'], limits: ['limits'],
};

interface Props {
  needId: string;
  childhoodRating?: number;
  activeSchemaIds: string[];
  onClose: () => void;
}

/** Лист потребности (редизайн 2026-11, b16): герой — бумага потребности с её знаком крупно (ExScreen look,
 *  needLook), а не NeedArt 16px между абзацами; связанные схемы — строки со знаком домена без вложенной
 *  рамки; балл в детстве — десять полосок цветом данных потребности (решение 7); советы — белый лист со
 *  знаком Leaf у надписи («что питает»). Стили — need-detail.css. */
export function NeedDetailSheet({ needId, childhoodRating, activeSchemaIds, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const tr = useTr();
  const NEED_DATA = useNeedData();
  const need = NEED_DATA[needId];

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
    .flatMap(d => d.schemas.filter(s => activeSchemaIds.includes(s.id)).map(s => ({ ...s, domainId: d.id })));

  const tips = level ? need.tips[level].slice(0, 3) : need.actions.slice(0, 3);
  const look = needLook(needId as NeedId);
  const ink = { '--h': look.hue, ...inkVars(needId) } as CSSProperties;

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      look={look}
      eyebrow="Потребность"
      title={<>{glue(need.name)}<br /><span className="it">{glue(need.subtitle)}</span></>}
      lede={need.explanation}
      aside={
        childhoodRating !== undefined ? (
          <div className="ds-card tk2-aside nd-score" style={ink}>
            <div className="ds-label">{tr('Твой балл в детстве', 'Ваш балл в детстве')}</div>
            <div className="nd-score-nums"><span className="nd-score-n">{childhoodRating}</span><span className="nd-score-unit">из 10</span></div>
            {rangeDesc && <p className="nd-score-desc">{rangeDesc}</p>}
            <div className="nd-bars" role="img" aria-label={`${childhoodRating} из 10`}>
              {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < childhoodRating ? 'is-on' : ''} />)}
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="nd-main" style={ink}>
        {relatedSchemas.length > 0 && (
          <div className="ds-card nd-card">
            <div className="ds-label">Связанные схемы</div>
            <div className="nd-rows">
              {relatedSchemas.map(s => (
                <div key={s.id} className="nd-row">
                  <DomainMark domainId={s.domainId} />
                  <div className="nd-row-text"><div className="nd-row-name">{s.name}</div><div className="nd-row-desc">{s.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ds-card nd-card">
          <TipHead>{level === 'low' ? 'Что поможет сейчас' : 'Что питает'}</TipHead>
          <ol className="nd-tips">
            {tips.map((tip, i) => <li key={i}><span className="nd-tip-n">{i + 1}</span><p>{tip}</p></li>)}
          </ol>
        </div>
      </div>
    </ExScreen>
  );
}
