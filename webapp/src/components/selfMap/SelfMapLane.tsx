import { pressable } from '../../utils/a11y';
import { modeItemSub, type MapLane } from '../../../../shared/src/map/mapVm';
import { SignArt } from '../art/SignArt';
import { modeSign } from '../art/guideSignsModel';

/**
 * Одна полоса карты себя. Пустая полоса — не укор, а информация: в
 * схема-терапии незаполненная клетка карты режимов и есть цель работы.
 * Строка — знак группы режима слева (тот же круг, что на сцене и у терапевта),
 * имя и счёт случаев; «приметы собраны» — галочкой, а не зелёной плашкой.
 */
export function SelfMapLane({
  lane,
  emptyHint,
  onPickMode,
}: {
  lane: MapLane;
  emptyHint: string;
  onPickMode: (modeId: string) => void;
}) {
  // Полоса без меток и без подсказки — голый заголовок над пустотой; такой полосы на экране нет.
  if (!lane.visible || (lane.items.length === 0 && !emptyHint)) return null;

  return (
    <section className="sm-lane" aria-label={lane.title}>
      <h3 className="ds-label sm-lane-title">{lane.title}</h3>
      {lane.items.length === 0 ? (
        <p className="sm-lane-empty">{emptyHint}</p>
      ) : (
        <div className="ds-rows sm-list">
          {lane.items.map((item) => (
            <div key={item.modeId} className={'ds-list-row ds-list-row--nav ds-list-row--hover' + (item.dormant ? ' is-dormant' : '')} {...pressable(() => onPickMode(item.modeId))}>
              <span className="pp-row-art" aria-hidden="true"><SignArt sign={modeSign(item.modeId)} size="row" /></span>
              <div className="ds-list-body">
                <div className="ds-list-title">{item.name}</div>
                <div className="ds-list-sub">{modeItemSub(item)}</div>
              </div>
              {item.hasCard && item.count > 0 && <span className="sm-card-mark"><SignArt sign="check" size="nav" />приметы собраны</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
