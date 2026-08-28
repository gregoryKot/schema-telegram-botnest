import { CapsLabel, DiaryPanel, DiaryRow } from '../diary/diaryUi';
import type { MapLane } from '../../../../shared/src/map/mapVm';
import { useTr } from '../../utils/addressForm';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';

/**
 * Одна полоса карты себя. Пустая полоса — не укор, а информация: в
 * схема-терапии незаполненная клетка карты режимов и есть цель работы. Поэтому
 * вместо «заполнено 2 из 4» здесь стоит фраза о том, откуда полоса возьмётся.
 *
 * Затихший режим (месяц без записей) не исчезает и не обнуляется — он гаснет
 * и показывается с давностью: это возвращает к вопросу «его правда нет или его
 * не видно», а не наказывает за пропуск.
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
    <div style={{ marginBottom: 22 }}>
      <CapsLabel>{lane.title}</CapsLabel>
      {lane.locked ? (
        <DiaryPanel style={{ opacity: 0.6 }}>
          <div
            style={{
              padding: '16px 14px',
              fontSize: 14,
              color: 'var(--muted)',
            }}
          >
            {tr(
              'Откроется после пяти разборов — раньше по записям не видно, откуда это тянется.',
              'Откроется после пяти разборов — раньше по записям не видно, откуда это тянется.',
            )}
          </div>
        </DiaryPanel>
      ) : lane.items.length === 0 ? (
        <DiaryPanel>
          <div
            style={{
              padding: '16px 14px',
              fontSize: 14,
              color: 'var(--muted)',
            }}
          >
            {emptyHint}
          </div>
        </DiaryPanel>
      ) : (
        <DiaryPanel>
          {lane.items.map((item) => (
            <DiaryRow
              key={item.modeId}
              title={item.name}
              desc={
                item.dormant
                  ? `Не появлялся в записях ${item.daysSince} дней`
                  : item.count === 0
                    ? 'Приметы собраны, случаев пока нет'
                    : `${item.count} ${pluralRu(item.count, 'случай', 'случая', 'случаев')}`
              }
              meta={item.hasCard ? 'приметы собраны' : undefined}
              onClick={() => onPickMode(item.modeId)}
            />
          ))}
        </DiaryPanel>
      )}
    </div>
  );
}
