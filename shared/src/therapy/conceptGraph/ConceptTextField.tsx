import { useId, type ReactNode } from 'react';
import { LimitedTextarea } from '../../components/LimitedTextarea';
import { CONCEPT_MODE_TEXT_MAX } from '../../limits/textLimits';
import { hintStyle, labelStyle } from './graphStyles';

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 'var(--r-12)',
  border: '1px solid rgba(var(--fg-rgb),0.12)',
  background: 'rgba(var(--fg-rgb),0.04)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 14,
  lineHeight: 1.5,
  resize: 'vertical',
} as const;

/**
 * Подпись + поле с пределом длины. `above` — плашка между подписью и полем,
 * `hint` — мелкая строка под полем («Этот текст виден на схеме»).
 */
export function ConceptTextField({
  label,
  placeholder,
  value,
  onChange,
  above,
  hint,
  max = CONCEPT_MODE_TEXT_MAX,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  above?: ReactNode;
  hint?: string;
  max?: number;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        style={{ ...labelStyle, display: 'block', marginBottom: 6 }}
      >
        {label}
      </label>
      {above}
      <LimitedTextarea
        id={id}
        max={max}
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={fieldStyle}
      />
      {hint && <div style={{ ...hintStyle, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
