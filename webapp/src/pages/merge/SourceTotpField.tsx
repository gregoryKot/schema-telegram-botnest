import { useTr } from '../../utils/addressForm';

// Поле для кода второго фактора ПОГЛОЩАЕМОГО аккаунта. Показывается, только
// когда сервер ответил source_totp_required (useMergeConfirm). Подходит и
// 6-значный код приложения, и резервный код (10 символов) — поэтому не numeric.
export function SourceTotpField({ code, onChange, disabled }: {
  code: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const tr = useTr();
  return (
    <div className="section">
      <div className="text-sm" style={{ lineHeight: 1.6, maxWidth: 600, marginBottom: 10 }}>
        {tr(
          'У второго аккаунта включена двухфакторная защита. Чтобы подтвердить, что он твой, введи код из его приложения-аутентификатора (или резервный код).',
          'У второго аккаунта включена двухфакторная защита. Чтобы подтвердить, что он ваш, введите код из его приложения-аутентификатора (или резервный код).',
        )}
      </div>
      <input
        type="text"
        autoComplete="one-time-code"
        aria-label="Код второго аккаунта"
        value={code}
        onChange={e => onChange(e.target.value)}
        placeholder="123456"
        disabled={disabled}
        maxLength={10}
        style={{
          padding: '12px 14px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-12)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 20,
          letterSpacing: '0.2em',
          fontFamily: 'monospace',
          width: 220,
        }}
      />
    </div>
  );
}
