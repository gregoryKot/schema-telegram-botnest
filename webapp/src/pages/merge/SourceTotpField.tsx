import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { CodeEntry } from '../login/CodeEntry';
import '../../styles/auth-login.css'; // ячейки OtpCells

// Код второго фактора ПОГЛОЩАЕМОГО аккаунта — только после source_totp_required (useMergeConfirm). Ввод
// тот же, что в окне кода и при отключении 2FA: CodeEntry (OtpCells или RecoveryCodeField).
export function SourceTotpField({ code, onChange, disabled }: {
  code: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const tr = useTr();
  const [recovery, setRecovery] = useState(false);
  const toggle = () => { setRecovery(!recovery); onChange(''); };
  return (
    <div className="am-field">
      <p className="am-lead">
        {tr(
          'У второго аккаунта включена двухфакторная защита. Чтобы подтвердить, что он твой, введи код из его приложения-аутентификатора (или резервный код).',
          'У второго аккаунта включена двухфакторная защита. Чтобы подтвердить, что он ваш, введите код из его приложения-аутентификатора (или резервный код).',
        )}
      </p>
      <CodeEntry recovery={recovery} onToggle={toggle} value={code} onChange={onChange} disabled={disabled} label="Код второго аккаунта" />
    </div>
  );
}
