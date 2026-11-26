import { useId } from 'react';
import { displayUserCodeInput, normalizeUserCode, USER_CODE_LENGTH } from '../../../../shared/src/auth/userCodeEntry';

// Поле восьмизначного кода. Сверка билета (S9, аудит 2026-11): человек набирает код с
// экрана приложения, откуда входит; «не совпадает» — только когда код набран целиком.
// Его же берёт привязка почты кодом из письма (EmailLinkCodeForm, своя подпись `label`).
// Тексты безличные: экран сверки (AuthConfirmPage) живёт вне AddressFormProvider.
export function TicketCodeField({ value, onChange, matches, disabled, label = 'Код из приложения' }: {
  value: string; onChange: (v: string) => void; matches: boolean; disabled: boolean; label?: string;
}) {
  const id = useId();
  return (
    <div className="as-field">
      <label htmlFor={id} className="ds-label">{label}</label>
      <input
        id={id}
        className="ds-input as-code-input"
        type="text"
        autoComplete="one-time-code" // одноразовый код, не свободный текст (трипваер №7)
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="XXXX-XXXX"
        value={displayUserCodeInput(value)}
        onChange={(e) => onChange(normalizeUserCode(e.target.value))}
        disabled={disabled}
      />
      {value.length === USER_CODE_LENGTH && !matches && (
        <span className="as-field-err">Код не совпадает с тем, что на экране приложения.</span>
      )}
    </div>
  );
}
