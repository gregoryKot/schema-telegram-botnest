import type { ReactNode } from 'react';
import { LineTabs } from '../../components/LineTabs';
import type { DiaryFilter } from './diaryModel';

const FILTERS: { id: DiaryFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'tracker', label: 'Трекер' },
  { id: 'case', label: 'Случаи' },
  { id: 'diary', label: 'Дневник' },
];

// Вкладки «Все · Трекер · Случаи · Дневник» с числами и мета под ними (b11): серия дней подряд поднята сюда из-под
// ленты, где её было не найти после длинного списка; в той же строке справа — тихая ссылка «Поделиться
// дневником» на «Дневнике» (ревью g3: не плашка между вкладками и серией).
export function DiaryBar({ filter, counts, onFilter, streak, share }: {
  /** Счётчики; null — не загружено (сбой, загрузка): «0» читался бы «записей нет». */
  filter: DiaryFilter; counts: Record<DiaryFilter, number | null> | null; onFilter: (f: DiaryFilter) => void;
  streak: string | null; share?: ReactNode;
}) {
  return (
    <div className="cd-bar">
      <LineTabs tabs={FILTERS.map(f => ({ ...f, count: counts?.[f.id] }))} value={filter} onPick={onFilter} label="Тип записей" look="scroll" />
      {(streak || share) && <div className="cd-bar-meta">{streak && <p className="cd-streak">{streak}</p>}{share}</div>}
    </div>
  );
}
