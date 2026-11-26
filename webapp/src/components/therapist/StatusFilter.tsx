import { LineTabs } from '../LineTabs';
import type { RosterStatus } from './rosterModel';

const FILTERS: readonly { id: RosterStatus; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Активны' },
  { id: 'wait', label: 'Не сегодня' }, // в боте, но сегодня без активности; «Ждут» путалось с «Ждут подключения»
  { id: 'virtual', label: 'Офлайн' },
];

/** Фильтр по статусу — тихий текстовый переключатель «Все · Активны · …»: выбранный — основным цветом с линией снизу. */
export function StatusFilter({ value, onChange }: { value: RosterStatus; onChange: (s: RosterStatus) => void }) {
  return <LineTabs look="quiet" label="Статус" className="lt-quiet--mark" tabs={FILTERS} value={value} onPick={onChange} />;
}
