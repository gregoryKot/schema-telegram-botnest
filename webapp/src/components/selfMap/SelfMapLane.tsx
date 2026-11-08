import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import type { MapLane } from '../../../../shared/src/map/mapVm';

/**
 * Одна полоса карты себя. Пустая полоса — не укор, а информация: в
 * схема-терапии незаполненная клетка карты режимов и есть цель работы.
 * Разметка — ds-label над списком ds-card--flush из ds-list-row (до 2026-11 —
 * старые section/list-line/chip из index.css).
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
  if (!lane.visible) return null;

  return (
    <section className="u-mb24" aria-label={lane.title}>
      <h3 className="ds-label u-mb8">{lane.title}</h3>
      {lane.locked ? (
        <p className="ds-sub">
          {tr(
            'Откроется после пяти разборов — раньше по записям не видно, откуда это тянется.',
            'Откроется после пяти разборов — раньше по записям не видно, откуда это тянется.',
          )}
        </p>
      ) : lane.items.length === 0 ? (
        <p className="ds-sub">{emptyHint}</p>
      ) : (
        <div className="ds-card ds-card--flush">
          {lane.items.map((item) => (
            <div
              key={item.modeId}
              className="ds-list-row ds-list-row--nav ds-list-row--hover"
              {...pressable(() => onPickMode(item.modeId))}
            >
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
              {item.hasCard && <span className="ds-badge ds-badge--ok">приметы собраны</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
