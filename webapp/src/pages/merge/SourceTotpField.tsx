import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import { OtpCells } from '../login/OtpCells';
import { RecoveryCodeField } from '../login/RecoveryCodeField';
import '../../styles/auth-login.css'; // ячейки OtpCells

// Код второго фактора ПОГЛОЩАЕМОГО аккаунта — только после source_totp_required (useMergeConfirm). Ввод
// тот же, что на входе с 2FA и в окне кода: OtpCells (6 цифр, one-time-code) или RecoveryCodeField (10 знаков).
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
      {recovery
        ? <RecoveryCodeField value={code} onChange={onChange} disabled={disabled} />
        : <OtpCells value={code} onChange={onChange} disabled={disabled} label="Код второго аккаунта" />}
      <button type="button" className="al-linkbtn" onClick={toggle} disabled={disabled}>
        {recovery ? 'Ввести код из приложения' : 'Использовать резервный код'}
      </button>
    </div>
  );
}
