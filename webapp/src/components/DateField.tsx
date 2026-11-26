import { dateFieldLabel } from './dateFieldLabel';

/**
 * Поле даты с подписью по-русски («26 ноября»): нативный input прозрачен поверх подписи — выбор тем же
 * календарём устройства, а формат не зависит от языка браузера (мм/дд/гггг на английской системе).
 */
export function DateField({ value, onChange, label, max }: {
  value: string; onChange: (value: string) => void; label: string; max?: string;
}) {
  return (
    <label className="ds-date">
      <span aria-hidden="true">{dateFieldLabel(value)}</span>
      <input type="date" lang="ru" className="ds-date-input" aria-label={label} value={value} max={max}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
