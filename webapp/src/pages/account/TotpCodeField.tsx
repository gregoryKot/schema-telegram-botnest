import { OtpCells } from '../login/OtpCells';
import '../../styles/auth-login.css'; // ячейки OtpCells

/** Код приложения в настройке и отключении 2FA. Один ввод кода на сайт — OtpCells, как на входе с 2FA и
 *  в окне кода (StepUpDialog): шесть ячеек поверх настоящего input с inputMode numeric и autoComplete
 *  one-time-code. Ошибка — сразу под полем (role=alert), а не внизу группы. */
export function TotpCodeField({ value, onChange, disabled, error }: {
  value: string; onChange: (v: string) => void; disabled: boolean; error: string | null;
}) {
  return (
    <div className="aa-code">
      <OtpCells value={value} onChange={onChange} disabled={disabled} label="Код из приложения" />
      {error && <p role="alert" className="aa-field-err">{error}</p>}
    </div>
  );
}
