import { useId } from 'react';
import { useTr } from '../../utils/addressForm';
import { displayUserCodeInput, normalizeUserCode, USER_CODE_LENGTH } from '../../../../shared/src/auth/userCodeEntry';

// Поле сверки кода билета (S9, аудит 2026-11): человек набирает код с экрана
// приложения, откуда входит, — из ссылки он не подставляется. Подсказка
// «не совпадает» появляется, только когда код набран целиком.
export function TicketCodeField({ value, onChange, matches, disabled }: {
  value: string; onChange: (v: string) => void; matches: boolean; disabled: boolean;
}) {
  const tr = useTr();
  const id = useId();
  return (
    <div className="as-field">
      <label htmlFor={id} className="ds-label">Код из приложения</label>
      <input
        id={id}
        className="ds-input as-code-input"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="XXXX-XXXX"
        value={displayUserCodeInput(value)}
        onChange={(e) => onChange(normalizeUserCode(e.target.value))}
        disabled={disabled}
      />
      {value.length === USER_CODE_LENGTH && !matches && (
        <span className="as-field-err">
          {tr(
            'Код не совпадает. Сверь его с экраном приложения ещё раз.',
            'Код не совпадает. Сверьте его с экраном приложения ещё раз.',
          )}
        </span>
      )}
    </div>
  );
}
