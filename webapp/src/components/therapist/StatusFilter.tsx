import type { RosterStatus } from './rosterModel';

const FILTERS: { key: RosterStatus; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'active', label: 'Активны' },
  { key: 'wait', label: 'Не сегодня' }, // в боте, но сегодня без активности; «Ждут» путалось с «Ждут подключения»
  { key: 'virtual', label: 'Офлайн' },
];

/** Фильтр по статусу — ряд чипов с переносом: это отбор, а не раздел, поэтому не вкладки (aria-pressed). */
export function StatusFilter({ value, onChange }: { value: RosterStatus; onChange: (s: RosterStatus) => void }) {
  return (
    <div className="tc-filter" role="group" aria-label="Статус">
      {FILTERS.map(f => (
        <button key={f.key} type="button" aria-pressed={value === f.key} onClick={() => onChange(f.key)}
                className={`ds-chip ds-chip--toggle${value === f.key ? ' is-on' : ''}`}>{f.label}</button>
      ))}
    </div>
  );
}
