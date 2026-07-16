// Текстовое поле дневниковой записи — общее для ModeEntrySheet и
// SchemaEntrySheet (правило №11 CLAUDE.md, jscpd-свип 2026-07).
export function DiaryTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
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
