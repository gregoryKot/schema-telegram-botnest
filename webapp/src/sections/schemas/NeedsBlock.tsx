import { NEED_ORDER, useNeedData } from '../../needData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import { needLevel } from './schemasModel';

interface Props {
  childhoodRatings: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
  onOpenNeed: (id: string) => void;
}

/** «Базовые потребности»: оценка детства (если есть) и вход в описание. */
export function NeedsBlock({ childhoodRatings, onOpenChildhoodWheel, onOpenNeed }: Props) {
  const NEED_DATA = useNeedData();
  const hasChildhood = Object.keys(childhoodRatings).length > 0;
  return (
    <section className="cs-block">
      <div className="ds-head-row">
        <h3 className="ds-h3">Базовые потребности</h3>
        <button className="ds-link" onClick={() => onOpenChildhoodWheel?.()}>
          {hasChildhood ? 'Изменить детство →' : 'Пройти колесо детства →'}
        </button>
      </div>
      <div className="ds-card ds-card--flush">
        {!hasChildhood && (
          <button className="ds-list-row ds-list-row--hover cs-need" onClick={() => onOpenChildhoodWheel?.()}>
            <span />
            <span className="cs-need-text">
              <span className="cs-need-name tone-text">Колесо детства</span>
              <span className="cs-need-hint">Как потребности удовлетворялись в детстве?</span>
            </span>
            <span className="cs-need-arrow">›</span>
          </button>
        )}
        {NEED_ORDER.map(id => {
          const d = NEED_DATA[id];
          if (!d) return null;
          const score = childhoodRatings[id];
          return (
            <button key={id} className="ds-list-row ds-list-row--hover cs-need" onClick={() => onOpenNeed(id)}>
              <span className="cs-need-icon tone-soft" style={hueStyle(NEED_HUE[id])}><IdentityDot id={id} size={14} /></span>
              <span className="cs-need-text">
                <span className="cs-need-name">{d.name}</span>
                <span className="cs-need-hint">{d.hint}</span>
              </span>
              {score !== undefined ? (
                <span className="cs-need-score">
                  <b className={`ds-num ds-idx-${needLevel(score)}`}>{score}</b>
                  <small>детство</small>
                </span>
              ) : <span className="cs-need-arrow">›</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
