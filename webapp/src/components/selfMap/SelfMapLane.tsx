import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import type { MapLane } from '../../../../shared/src/map/mapVm';
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
  const tr = useTr();
  // Открытая полоса без меток и без подсказки («Откуда тянется»: своих данных у неё нет, mapVm.ts)
  // — голый заголовок над пустотой; такой полосы на экране нет.
  if (!lane.visible || (!lane.locked && lane.items.length === 0 && !emptyHint)) return null;
  const fallback = lane.locked
    ? tr('Откроется после пяти разборов — раньше по записям не видно, откуда это тянется.', 'Откроется после пяти разборов — раньше по записям не видно, откуда это тянется.')
    : emptyHint;

  return (
    <section className="sm-lane" aria-label={lane.title}>
      <h3 className="ds-label sm-lane-title">{lane.title}</h3>
      {lane.locked || lane.items.length === 0 ? (
        <p className="sm-lane-empty">{fallback}</p>
      ) : (
        <div className="ds-card ds-card--flush sm-list">
          {lane.items.map((item) => (
            <div key={item.modeId} className={'ds-list-row ds-list-row--nav ds-list-row--hover' + (item.dormant ? ' is-dormant' : '')} {...pressable(() => onPickMode(item.modeId))}>
              <span className="pp-row-art" aria-hidden="true"><SignArt sign={modeSign(item.modeId)} size="row" /></span>
              <div className="ds-list-body">
                <div className="ds-list-title">{item.name}</div>
                <div className="ds-list-sub">
                  {item.dormant
                    ? `Не появлялся в записях ${item.daysSince} дней`
                    : item.count === 0
                      ? 'Приметы собраны, случаев пока нет'
                      : `${item.count} ${pluralRu(item.count, 'случай', 'случая', 'случаев')}`}
                </div>
              </div>
              {item.hasCard && item.count > 0 && <span className="sm-card-mark"><SignArt sign="check" size="nav" />приметы собраны</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
