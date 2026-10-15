import { useId } from 'react';
import { CONCEPT_MODE_ALIAS_MAX } from '../../limits/textLimits';
import { labelStyle } from './graphStyles';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 'var(--r-12)',
  border: '1px solid rgba(var(--fg-rgb),0.12)',
  background: 'rgba(var(--fg-rgb),0.04)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 14,
} as const;

/**
 * «Как называет клиент»: лучшая практика карты режимов — имена самого клиента
 * («Судья», «Маленькая Аня»), а не термины метода.
 */
export function ConceptAliasField({
  value,
  onChange,
}: {
  value: string;
  onChange: (alias: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        style={{ ...labelStyle, display: 'block', marginBottom: 6 }}
      >
        Как называет клиент
      </label>
      <input
        id={id}
        className="ym-disable-keys"
        maxLength={CONCEPT_MODE_ALIAS_MAX}
        value={value}
        placeholder="Например, «Судья» или «Маленькая Аня»"
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}
