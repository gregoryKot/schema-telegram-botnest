import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import type { MapLane } from '../../../../shared/src/map/mapVm';

/**
 * Одна полоса карты себя. Пустая полоса — не укор, а информация: в
 * схема-терапии незаполненная клетка карты режимов и есть цель работы.
 * Twin schema-miniapp SelfMapLane.tsx, разметка — webapp section/list-line.
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
    <div className="section">
      <div className="section-head">
        <h3>{lane.title}</h3>
      </div>
      {lane.locked ? (
        <div className="text-sm muted" style={{ padding: '8px 0', lineHeight: 1.55 }}>
          {tr(
            'Откроется после пяти разборов — раньше по записям не видно, откуда это тянется.',
            'Откроется после пяти разборов — раньше по записям не видно, откуда это тянется.',
          )}
        </div>
      ) : lane.items.length === 0 ? (
        <div className="text-sm muted" style={{ padding: '8px 0', lineHeight: 1.55 }}>
          {emptyHint}
        </div>
      ) : (
        lane.items.map((item) => (
          <div
            key={item.modeId}
            className="list-line"
            style={{ cursor: 'pointer' }}
            {...pressable(() => onPickMode(item.modeId))}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-md" style={{ fontWeight: 600 }}>{item.name}</div>
              <div className="text-sm muted" style={{ marginTop: 2 }}>
                {item.dormant
                  ? `Не появлялся в записях ${item.daysSince} дней`
                  : item.count === 0
                    ? 'Приметы собраны, случаев пока нет'
                    : `${item.count} ${pluralRu(item.count, 'случай', 'случая', 'случаев')}`}
              </div>
            </div>
            {item.hasCard && <span className="chip chip-success">приметы собраны</span>}
          </div>
        ))
      )}
    </div>
  );
}
