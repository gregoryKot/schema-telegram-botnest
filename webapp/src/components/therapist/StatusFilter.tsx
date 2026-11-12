import type { RosterStatus } from './rosterModel';
import { useTabsBar } from './useTabsBar';

const FILTERS: { key: RosterStatus; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активны' },
  { key: 'wait', label: 'Не сегодня' }, // в боте, но сегодня без активности; «Ждут» путалось с «Ждут подключения»
  { key: 'virtual', label: 'Офлайн' },
];

/** Фильтр по статусу — полоса с прокруткой и маской у края, как фильтр «Записей клиента» (useTabsBar, r2: на 320
 *  «Офл…» обрезалось без маски). Свой компонент — хук следит за полосой с её появления (после загрузки списка). */
export function StatusFilter({ value, onChange }: { value: RosterStatus; onChange: (s: RosterStatus) => void }) {
  const { ref, onScroll, fadeClassName } = useTabsBar(value);
  return (
    <div className={`ds-seg ds-seg--scroll tk-fade-bar${fadeClassName}`} ref={ref} onScroll={onScroll}>
      {FILTERS.map(f => (
        <button key={f.key} className={`ds-seg-btn ${value === f.key ? 'is-active' : ''}`}
                onClick={() => onChange(f.key)}>{f.label}</button>
      ))}
    </div>
  );
}
