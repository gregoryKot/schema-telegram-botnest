import type { DiaryType } from '../../types';
import { EntryRow } from './EntryRow';
import { DayHead } from './DayHead';
import { entryKey, type AnyEntry } from './diaryModel';
import { splitDay } from './dayModel';

// Лента, сгруппированная по дням: строка даты (DayHead — дата и трекер дня полосками), под ней
// карточки записей; на компьютере дата — колонкой слева (client-diary.css). День только с трекером —
// одна строка даты без карточек.
export function DiaryTimeline({ groups, onDelete, onOpenTrackerHistory }: {
  groups: { dateKey: string; items: AnyEntry[] }[];
  onDelete: (type: DiaryType, id: number) => Promise<void>;
  /** Тап по трекеру дня; без него строка не нажимается (лист «Дневники» из практик). */
  onOpenTrackerHistory?: () => void;
}) {
  return (
    <div className="cd-timeline">
      {groups.map(({ dateKey, items }) => {
        const { tracker, entries } = splitDay(items);
        return (
          <section key={dateKey} className={entries.length ? 'cd-day' : 'cd-day cd-day--bare'}>
            <DayHead dateKey={dateKey} tracker={tracker} onOpenTracker={onOpenTrackerHistory} />
            {entries.length > 0 && <div className="cd-day-items">
              {entries.map(item => <EntryRow key={entryKey(item)} item={item} onDelete={onDelete} />)}
            </div>}
          </section>
        );
      })}
    </div>
  );
}
