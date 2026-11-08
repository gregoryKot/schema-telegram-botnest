import { useId } from 'react';
import { displayUserCodeInput, normalizeUserCode, USER_CODE_LENGTH } from '../../../../shared/src/auth/userCodeEntry';

// Поле сверки кода билета (S9, аудит 2026-11): человек набирает код с экрана
// приложения, откуда входит, — из ссылки он не подставляется. Подсказка
// «не совпадает» появляется, только когда код набран целиком. Тексты безличные:
// экран сверки (AuthConfirmPage) живёт вне AddressFormProvider.
export function TicketCodeField({ value, onChange, matches, disabled }: {
  value: string; onChange: (v: string) => void; matches: boolean; disabled: boolean;
}) {
  const id = useId();
  return (
    <div className="as-field">
      <label htmlFor={id} className="ds-label">Код из приложения</label>
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
