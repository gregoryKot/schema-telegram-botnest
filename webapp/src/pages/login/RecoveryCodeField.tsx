import { forwardRef } from 'react';

/** Резервный код — 10 символов hex (`src/auth/totp.service.ts`, RECOVERY_CODE_BYTES). */
const RECOVERY_CODE_LENGTH = 10;

/**
 * Пробелы и дефисы, которые приезжают при копировании из заметок, срезаются;
 * регистр — нижний (сервер сравнивает в нижнем, а клавиатура телефона сама
 * делает первую букву заглавной).
 */
function normalizeRecoveryCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toLowerCase().slice(0, RECOVERY_CODE_LENGTH);
}

// Поле резервного кода: в нём буквы a–f, поэтому клавиатура буквенная, без
// автозамены и заглавной первой буквы. one-time-code — только у кода из
// приложения (OtpCells): здесь телефон подсовывал бы цифровые SMS-коды.
export const RecoveryCodeField = forwardRef<HTMLInputElement, {
  value: string; onChange: (v: string) => void; disabled: boolean;
}>(function RecoveryCodeField({ value, onChange, disabled }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      className="ds-input"
      inputMode="text"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      aria-label="Recovery-код"
      value={value}
      onChange={e => onChange(normalizeRecoveryCode(e.target.value))}
      placeholder="recovery-код"
      disabled={disabled}
    />
  );
});
