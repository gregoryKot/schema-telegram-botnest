import type { DiaryType } from '../../types';
import { Skeleton } from '../../components/Skeleton';
import { dateRelLabel, fmtDayMonth, fmtWeekday } from './dateHelpers';
import { SchemaEntry, ModeEntry, GratitudeEntry } from './EntryCards';
import type { AnyEntry } from './diaryModel';

export function DiaryTimelineSkeleton() {
  return (
    <div className="cd-timeline" aria-hidden>
      {[0, 1].map(i => (
        <div key={i} className="cd-day">
          <Skeleton width={72} height={30} />
          <div className="cd-day-items">
            <Skeleton height={86} radius={16} />
            <Skeleton height={86} radius={16} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Лента, сгруппированная по дням: слева дата и «сегодня/вчера», справа карточки записей.
export function DiaryTimeline({ groups, onDelete }: {
  groups: { dateKey: string; items: AnyEntry[] }[];
  onDelete: (type: DiaryType, id: number) => void;
}) {
  return (
    <div className="cd-timeline">
      {groups.map(({ dateKey, items }) => {
        const rel = dateRelLabel(dateKey);
        return (
          <div key={dateKey} className="cd-day">
            <div>
              <div className="cd-day-date">{fmtDayMonth(dateKey)}</div>
              <div className="cd-day-rel">{rel ? `${rel} · ` : ''}{fmtWeekday(dateKey)}</div>
            </div>
            <div className="cd-day-items">
              {items.map(item => item._type === 'schema'
                ? <SchemaEntry key={'s-' + item.entry.id} entry={item.entry} onDelete={() => onDelete('schema', item.entry.id)} />
                : item._type === 'mode'
                  ? <ModeEntry key={'m-' + item.entry.id} entry={item.entry} onDelete={() => onDelete('mode', item.entry.id)} />
                  : <GratitudeEntry key={'g-' + item.entry.id} entry={item.entry} onDelete={() => onDelete('gratitude', item.entry.id)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
