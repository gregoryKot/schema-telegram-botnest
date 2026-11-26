import type { Ref } from 'react';
import { FieldError } from '../../components/paper/FieldError';
import { OtpCells } from './OtpCells';
import { RecoveryCodeField } from './RecoveryCodeField';

// Код второго фактора с переключателем «код из приложения / резервный код» — одна механика (правило №3) на
// окно кода (StepUpDialog), код поглощаемого аккаунта (SourceTotpField) и отключение 2FA в аккаунте
// (TotpCodeField): OtpCells — 6 цифр, one-time-code; RecoveryCodeField — 10 знаков. Режим держит экран.
export function CodeEntry({ recovery, onToggle, value, onChange, disabled, label, inputRef, error }: {
  recovery: boolean; onToggle: () => void;
  value: string; onChange: (v: string) => void; disabled: boolean;
  /** Доступное имя ячеек кода из приложения. */
  label: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Ошибка — сразу под полем, над переключателем (FieldError, role=alert). */
  error?: string | null;
}) {
  return (
    <>
      {recovery
        ? <RecoveryCodeField ref={inputRef} value={value} onChange={onChange} disabled={disabled} />
        : <OtpCells ref={inputRef} value={value} onChange={onChange} disabled={disabled} label={label} />}
      {error && <FieldError>{error}</FieldError>}
      <button type="button" className="al-linkbtn" onClick={onToggle} disabled={disabled}>
        {recovery ? 'Ввести код из приложения' : 'Использовать резервный код'}
      </button>
    </>
  );
}
