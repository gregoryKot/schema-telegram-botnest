// Текстовое поле дневниковой записи — общее для ModeEntrySheet и
// SchemaEntrySheet (правило №11 CLAUDE.md, jscpd-свип 2026-07).
//
// В7 дизайн-аудита 2026-08: вопрос был связан с полем только placeholder'ом,
// который исчезает при вводе — человек с рабочей памятью «на пределе» теряет
// вопрос. `labelId` связывает поле с уже отрисованным видимым вопросом
// (aria-labelledby); `ariaLabel` — фолбэк, когда рядом нет отдельного
// видимого вопроса (например, `schemaOrigin` внутри шага «Схемы»).
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
    <textarea
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
        borderRadius: 12,
        padding: '12px 14px',
        color: 'var(--text)',
        fontSize: 14,
        lineHeight: 1.5,
        outline: 'none',
      }}
    />
  );
}
