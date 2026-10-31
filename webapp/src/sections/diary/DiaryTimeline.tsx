import type { DiaryType } from '../../types';
import { Skeleton } from '../../components/Skeleton';
import { dateRelLabel, fmtDayMonth, fmtWeekday } from './dateHelpers';
import { EntryRow } from './EntryRow';
import { entryKey, type AnyEntry } from './diaryModel';

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
export function DiaryTimeline({ groups, onDelete, onOpenTrackerHistory }: {
  groups: { dateKey: string; items: AnyEntry[] }[];
  onDelete: (type: DiaryType, id: number) => void;
  /** Тап по строке трекера; без него строка не нажимается (лист «Дневники» из практик). */
  onOpenTrackerHistory?: () => void;
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
              {items.map(item => <EntryRow key={entryKey(item)} item={item} onDelete={onDelete} onOpenTrackerHistory={onOpenTrackerHistory} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
