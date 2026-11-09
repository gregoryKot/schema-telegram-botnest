import type { ReactNode } from 'react';
import type { DiaryFilter } from './diaryModel';

const FILTERS: { id: DiaryFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'tracker', label: 'Трекер' },
  { id: 'case', label: 'Случаи' },
  { id: 'diary', label: 'Дневник' },
];

// Сегмент «Все · Трекер · Случаи · Дневник» и мета под ним (b11): серия дней подряд поднята сюда из-под
// ленты, где её было не найти после длинного списка; справа — «Поделиться дневником» на «Дневнике».
export function DiaryBar({ filter, counts, onFilter, streak, share }: {
  /** Счётчики; null — не загружено (сбой, загрузка): «0» читался бы «записей нет». */
  filter: DiaryFilter; counts: Record<DiaryFilter, number | null> | null; onFilter: (f: DiaryFilter) => void;
  streak: string | null; share?: ReactNode;
}) {
  return (
    <div className="cd-bar">
      <div className="ds-seg ds-seg--scroll" role="group" aria-label="Тип записей">
        {FILTERS.map(f => (
          <button key={f.id} type="button" className={'ds-seg-btn' + (filter === f.id ? ' is-active' : '')} aria-pressed={filter === f.id} onClick={() => onFilter(f.id)}>
            {f.label}{counts?.[f.id] != null && <span className="ds-count">{counts[f.id]}</span>}
          </button>
        ))}
      </div>
      {share}
      {streak && <p className="cd-streak">{streak}</p>}
    </div>
  );
}
