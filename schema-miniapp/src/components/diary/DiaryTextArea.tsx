// Поле дневниковой записи, общее для ModeEntrySheet и SchemaEntrySheet
// (правило №11). В7 дизайн-аудита 2026-08: `labelId` связывает поле с видимым
// вопросом (aria-labelledby), placeholder исчезает при вводе; `ariaLabel` —
// фолбэк, когда отдельного вопроса рядом нет (`schemaOrigin` в шаге «Схемы»).
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import { DIARY_FIELD_MAX } from '../../../../shared/src/limits/textLimits';

export function DiaryTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  labelId,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  labelId?: string;
  ariaLabel?: string;
}) {
  return (
    <LimitedTextarea
      max={DIARY_FIELD_MAX}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      aria-labelledby={labelId}
      aria-label={labelId ? undefined : ariaLabel}
      className="field-input"
      style={{
        width: '100%',
        background: 'rgba(var(--fg-rgb),0.05)',
        border: '1px solid rgba(var(--fg-rgb),0.1)',
        borderRadius: 'var(--r-12)',
        padding: '12px 14px',
        color: 'var(--text)',
        fontSize: 14,
        lineHeight: 1.5,
        outline: 'none',
      }}
    />
  );
}
