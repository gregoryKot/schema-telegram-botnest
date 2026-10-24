import { AddClient } from '../types';
import { AddSubmitButton } from './AddSubmitButton';

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
  maxLength,
}: {
  addClient: AddClient;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  placeholder: string;
  submitLabel: string;
  hint: string;
  accent?: boolean;
  inputMode?: 'numeric';
  /** Предел длины поля (имя офлайн-клиента); у Telegram ID не задаётся. */
  maxLength?: number;
}) {
  const { addInput, setAddInput, addError, setAddError, addLoading } =
    addClient;
  const filled = !!addInput.trim();
  return (
    <>
      <div className="u-row8">
        <input
          value={addInput}
          onChange={(e) => {
            setAddInput(e.target.value);
            setAddError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
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
        <AddSubmitButton
          onClick={onSubmit}
          disabled={addLoading || !filled}
          filled={filled}
          accent={accent}
          label={addLoading ? '...' : submitLabel}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
        {hint}
      </div>
    </>
  );
}
