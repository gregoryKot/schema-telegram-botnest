import { useState } from 'react'; import { DateField } from '../../../DateField';
import { formatDateString, isCalendarDate } from '../../../../../../shared/src/utils/calendarDate';

interface Props {
  startDate: string;
  busy: boolean;
  /** true — сохранено, поле закрывается. */
  onSave: (startDate: string) => Promise<boolean>;
}

/** Старт пути в шапке ленты: «Изменить старт» раскрывает поле даты; сроки фаз пересчитываются от него. */
export function PathStartEdit({ startDate, busy, onSave }: Props) {
  const [value, setValue] = useState<string | null>(null);
  const save = async () => {
    if (value == null || !isCalendarDate(value) || busy) return;
    if (value === startDate || (await onSave(value))) setValue(null);
  };
  if (value == null) {
    return (
      <div className="ph-start">
        <span className="ds-sub">Старт пути: {formatDateString(startDate, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary ph-quiet" onClick={() => setValue(startDate)}>Изменить старт</button>
      </div>
    );
  }
  return (
    <div className="ph-start">
      <div className="ph-date">
        <span className="ds-label">Старт пути</span>
        <DateField label="Старт пути" value={value} onChange={setValue} />
      </div>
      <button type="button" className="ds-btn ds-btn--sm ph-quiet" disabled={!isCalendarDate(value) || busy} aria-busy={busy || undefined} onClick={() => void save()}>Сохранить</button>
      <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary ph-quiet" disabled={busy} onClick={() => setValue(null)}>Отмена</button>
    </div>
  );
}
