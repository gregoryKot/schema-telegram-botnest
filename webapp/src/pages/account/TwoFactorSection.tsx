import { useState } from 'react';
import { API_BASE } from '../../utils/apiBase'; import { useTr } from '../../utils/addressForm';
import { TwoFactorScopeNote } from './TwoFactorScopeNote';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';

// Секция двухфакторной аутентификации (TOTP), вынесена из AccountPage.tsx (правило №10).
export function TwoFactorSection({
  accessToken, totp, onChanged,
}: {
  accessToken: string | null;
  totp: { enabled: boolean; recoveryCodesLeft: number };
  onChanged: () => void;
}) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null); const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableMode, setDisableMode] = useState(false); const tr = useTr();

  const csrfHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    'x-requested-with': 'webapp',
    Authorization: `Bearer ${accessToken}`,
  });

  const startSetup = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/setup`, { method: 'POST', credentials: 'include', headers: csrfHeaders() });
      if (!res.ok) throw new Error((await readHumanError(res, 'Не удалось начать настройку')).message);
      const data = await res.json() as { qrDataUrl: string; otpauthUrl: string };
      setQrDataUrl(data.qrDataUrl);
      setOtpauthUrl(data.otpauthUrl);
      setSetupOpen(true);
    } catch (e) { setError(humanizeThrown(e, 'Не удалось начать настройку')); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/enable`, {
        method: 'POST', credentials: 'include', headers: csrfHeaders(),
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) throw new Error((await readHumanError(res, 'Неверный код')).message);
      const data = await res.json() as { recoveryCodes: string[] };
      setRecoveryCodes(data.recoveryCodes);
      setCode('');
      setQrDataUrl(null);
      onChanged();
    } catch (e) { setError(humanizeThrown(e, 'Не получилось проверить код')); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/disable`, {
        method: 'POST', credentials: 'include', headers: csrfHeaders(),
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) throw new Error((await readHumanError(res, 'Неверный код')).message);
      setCode('');
      setDisableMode(false);
      onChanged();
    } catch (e) { setError(humanizeThrown(e, 'Не получилось проверить код')); }
    finally { setBusy(false); }
  };

  if (recoveryCodes) {
    return (
      <div className="ds-card aa-tfa">
        <h2 className="ds-h3">Recovery-коды</h2>
        <div className="aa-small">
          {tr('Сохрани эти коды в надёжном месте (пароль-менеджер). Каждый можно использовать один раз вместо TOTP-кода, если потеряешь телефон.', 'Сохраните эти коды в надёжном месте (пароль-менеджер). Каждый можно использовать один раз вместо TOTP-кода, если потеряете телефон.')}
        </div>
        <div className="aa-codes">
          {recoveryCodes.map(c => <div key={c}>{c}</div>)}
        </div>
        <button onClick={() => setRecoveryCodes(null)} className="ds-btn ds-btn--secondary" style={{ alignSelf: 'flex-start' }}>
          Готово, коды сохранены
        </button>
      </div>
    );
  }

  const cancelSetup = () => { setSetupOpen(false); setQrDataUrl(null); setCode(''); setError(null); };
  const cancelDisable = () => { setDisableMode(false); setCode(''); setError(null); };
  // Переключатель — единственная точка входа: выключен → начать настройку
  // (или отменить начатую), включён → режим отключения (или отмена).
  const onToggle = () => {
    if (totp.enabled) { if (disableMode) cancelDisable(); else setDisableMode(true); }
    else if (setupOpen) cancelSetup();
    else void startSetup();
  };
  const codeInput = (
    <input
      value={code} onChange={e => setCode(e.target.value)}
      placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
      className="ds-input aa-code-input"
    />
  );

  return (
    <div className="ds-card aa-tfa">
      <div className="aa-tfa-head">
        <h2 className="ds-h3" id="aa-tfa-title">Двухфакторная защита</h2>
        <button
          type="button" role="switch" aria-checked={totp.enabled} aria-labelledby="aa-tfa-title"
          className="ds-switch" disabled={busy} onClick={onToggle}
        >
          <span className="ds-switch-knob" />
        </button>
      </div>
      <TwoFactorScopeNote />

      {!totp.enabled && !setupOpen && (
        <div className="aa-tfa-text">
          Дополнительный код из приложения (Google Authenticator, 1Password, …) при каждом входе.{' '}
          {tr('Защищает аккаунт даже если у тебя украдут Google/Telegram/VK.', 'Защищает аккаунт даже если у вас украдут Google/Telegram/VK.')}
        </div>
      )}

      {totp.enabled && !disableMode && (
        <div className="aa-recovery-row">
          <span style={{ color: 'var(--ok-ink)' }}>✓ Включена.</span>
          <span className="muted">Recovery-кодов осталось: {totp.recoveryCodesLeft}</span>
        </div>
      )}

      {totp.enabled && disableMode && (
        <div className="aa-stack">
          <div className="aa-small">{tr('Введи текущий код из приложения, чтобы отключить:', 'Введите текущий код из приложения, чтобы отключить:')}</div>
          {codeInput}
          <div className="aa-actions">
            <button onClick={disable} disabled={busy || !code.trim()} className="ds-btn">
              {busy ? 'Отключаю…' : 'Отключить'}
            </button>
            <button onClick={cancelDisable} disabled={busy} className="ds-btn ds-btn--secondary">
              Отмена
            </button>
          </div>
        </div>
      )}

      {!totp.enabled && setupOpen && qrDataUrl && (
        <div className="aa-stack">
          <div className="aa-small">
            {tr('1. Установи приложение-аутентификатор (Google Authenticator, 1Password, Bitwarden, Authy).', '1. Установите приложение-аутентификатор (Google Authenticator, 1Password, Bitwarden, Authy).')}<br/>
            {tr('2. Отсканируй QR. Или введи секрет вручную из ссылки ниже.', '2. Отсканируйте QR. Или введите секрет вручную из ссылки ниже.')}<br/>
            {tr('3. Введи 6-значный код из приложения, чтобы завершить.', '3. Введите 6-значный код из приложения, чтобы завершить.')}
          </div>
          <div className="aa-qr">
            <img src={qrDataUrl} alt="TOTP QR" width={200} height={200} />
          </div>
          {otpauthUrl && (
            <details className="aa-small">
              <summary className="u-pointer">Не сканируется QR? Ввести секрет вручную</summary>
              <div className="aa-secret">{otpauthUrl}</div>
            </details>
          )}
          {codeInput}
          <div className="aa-actions">
            <button onClick={confirm} disabled={busy || !code.trim()} className="ds-btn">
              {busy ? 'Проверяю…' : 'Подтвердить'}
            </button>
            <button onClick={cancelSetup} disabled={busy} className="ds-btn ds-btn--secondary">
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && <div className="aa-fail">{error}</div>}
    </div>
  );
}
