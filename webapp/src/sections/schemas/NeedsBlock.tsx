import { NEED_ORDER, useNeedData } from '../../needData';
import { NeedArt } from '../../components/art/NeedArt';
import { EntitySheet } from '../../components/paper/EntitySheet';
import { needLevel } from './schemasModel';
import { NEEDS_WHAT } from '../../../../shared/src/pattern/patternTerms';

interface Props {
  childhoodRatings: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
  onOpenNeed: (id: string) => void;
}

/** «Базовые потребности»: оценка детства (если есть) и вход в описание; до колеса детства — что это
 *  (онбординг) и колесо первым шагом: лист-герой колеса (бумага и знак из ENTITY_LOOK) с одной кнопкой. */
export function NeedsBlock({ childhoodRatings, onOpenChildhoodWheel, onOpenNeed }: Props) {
  const NEED_DATA = useNeedData();
  const hasChildhood = Object.keys(childhoodRatings).length > 0;
  return (
    <section className="cs-block">
      <div className="ds-head-row">
        <h3 className="ds-h3">Базовые потребности</h3>
        {hasChildhood && <button className="ds-link" onClick={() => onOpenChildhoodWheel?.()}>Изменить детство →</button>}
      </div>
      {!hasChildhood && <p className="ds-empty">{NEEDS_WHAT}</p>}
      {!hasChildhood && (
        <EntitySheet look="childhood_wheel" title="Колесо детства" sub="Как потребности удовлетворялись в детстве?" className="cs-wheel">
          <button type="button" className="ds-btn cs-intro-btn" onClick={() => onOpenChildhoodWheel?.()}>Пройти колесо детства →</button>
        </EntitySheet>
      )}
      <div className="ds-card ds-card--flush">
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
