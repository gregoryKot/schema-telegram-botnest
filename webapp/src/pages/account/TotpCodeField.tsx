import { useState } from 'react';
import { OtpCells } from '../login/OtpCells';
import { CodeEntry } from '../login/CodeEntry';
import { FieldError } from '../../components/paper/FieldError';
import '../../styles/auth-login.css'; // ячейки OtpCells

/** Код приложения в настройке и отключении 2FA. Один ввод кода на сайт — OtpCells, как на входе с 2FA и
 *  в окне кода (StepUpDialog). Настройка — только 6 цифр (резервных кодов ещё нет); отключение принимает и
 *  резервный код (сервер: totp.service.ts disable → verifyCode) — переключатель CodeEntry. Ошибка — сразу
 *  под полем (FieldError, role=alert), а не внизу группы. */
export function TotpCodeField({ value, onChange, disabled, error, allowRecovery = false }: {
  value: string; onChange: (v: string) => void; disabled: boolean; error: string | null; allowRecovery?: boolean;
}) {
  const [recovery, setRecovery] = useState(false);
  const toggle = () => { setRecovery(!recovery); onChange(''); };
  return (
    <div className="aa-code">
      {allowRecovery
        ? <CodeEntry recovery={recovery} onToggle={toggle} value={value} onChange={onChange} disabled={disabled}
                     label="Код из приложения" error={error} />
        : <>
            <OtpCells value={value} onChange={onChange} disabled={disabled} label="Код из приложения" />
            {error && <FieldError>{error}</FieldError>}
          </>}
    </div>
  );
}
