import { NEED_ORDER, useNeedData } from '../../needData';
import { NeedArt } from '../../components/art/NeedArt';
import { needLevel } from './schemasModel';
import { NEEDS_WHAT } from '../../../../shared/src/pattern/patternTerms';

interface Props {
  childhoodRatings: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
  onOpenNeed: (id: string) => void;
}

/** «Базовые потребности»: оценка детства (если есть) и вход в описание; до колеса детства — что это (онбординг). */
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
      {!hasChildhood && <p className="ds-empty">{NEEDS_WHAT}</p>}
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
        {NEED_ORDER.filter(id => NEED_DATA[id]).map(id => {
          const d = NEED_DATA[id];
          const score = childhoodRatings[id];
          return (
            <button key={id} className="ds-list-row ds-list-row--hover cs-need" onClick={() => onOpenNeed(id)}>
              <span className="pp-row-art"><NeedArt id={id} size="row" /></span>
              <span className="cs-need-text">
                <span className="cs-need-name">{d.name}</span>
                <span className="cs-need-hint">{d.hint}</span>
              </span>
              {score !== undefined ? (
                <span className="cs-need-score">
                  <b className={`ds-num ds-idx-${needLevel(score)}`}>{score}</b><small>детство</small>
                </span>
              ) : <span className="cs-need-arrow">›</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
