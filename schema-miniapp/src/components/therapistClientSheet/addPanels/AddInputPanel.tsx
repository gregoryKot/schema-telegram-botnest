import { AddClient } from '../types';

// Панель добавления клиента одним полем: ввод + кнопка + подпись.
// Общая для «Telegram ID» и «оффлайн-клиента» — механика одна, различаются
// подпись, плейсхолдер и цвет кнопки (правило «одна механика — один
// компонент»; вынесено из ClientListView.tsx по правилу №10).
export function AddInputPanel({
  addClient,
  inputRef,
  onSubmit,
  placeholder,
  submitLabel,
  hint,
  accent = false,
  inputMode,
}: {
  addClient: AddClient;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  placeholder: string;
  submitLabel: string;
  hint: string;
  accent?: boolean;
  inputMode?: 'numeric';
}) {
  const { addInput, setAddInput, addError, setAddError, addLoading } =
    addClient;
  const filled = !!addInput.trim();
  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
        <input
          value={addInput}
          onChange={(e) => {
            setAddInput(e.target.value);
            setAddError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder={placeholder}
          inputMode={inputMode}
          ref={inputRef}
          style={{
            flex: 1,
            background: 'rgba(var(--fg-rgb),0.06)',
            border: `1px solid ${addError ? 'var(--accent-red)' : 'rgba(var(--fg-rgb),0.12)'}`,
            borderRadius: 'var(--r-10)',
            padding: '9px 12px',
            outline: 'none',
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
        <button
          onClick={onSubmit}
          disabled={addLoading || !filled}
          style={{
            padding: '9px 16px',
            borderRadius: 'var(--r-10)',
            border: 'none',
            background: filled
              ? accent
                ? 'var(--accent)'
                : 'rgba(var(--fg-rgb),0.12)'
              : 'rgba(var(--fg-rgb),0.05)',
            color: filled
              ? accent
                ? '#fff'
                : 'var(--text)'
              : 'rgba(var(--fg-rgb),0.3)',
            fontSize: 13,
            fontWeight: 600,
            cursor: filled ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          {addLoading ? '...' : submitLabel}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
        {hint}
      </div>
    </>
  );
}
