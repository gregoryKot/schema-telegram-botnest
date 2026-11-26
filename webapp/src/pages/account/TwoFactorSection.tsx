import { useState } from 'react';
import { API_BASE } from '../../utils/apiBase'; import { useTr } from '../../utils/addressForm';
import { TwoFactorScopeNote } from './TwoFactorScopeNote';
import { RecoveryCodesCard } from './RecoveryCodesCard';
import { OkMark } from './OkMark';
import { TotpCodeField } from './TotpCodeField';
import { FieldError } from '../../components/paper/FieldError';
import { GlyphChevron } from '../../components/exercises/ExGlyphs';
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

  if (recoveryCodes) return <RecoveryCodesCard codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />;

  const cancelSetup = () => { setSetupOpen(false); setQrDataUrl(null); setCode(''); setError(null); };
  const cancelDisable = () => { setDisableMode(false); setCode(''); setError(null); };
  // Переключатель — единственная точка входа: выключен → начать настройку
  // (или отменить начатую), включён → режим отключения (или отмена).
  const onToggle = () => {
    if (totp.enabled) { if (disableMode) cancelDisable(); else setDisableMode(true); }
    else if (setupOpen) cancelSetup();
    else void startSetup();
  };
  const codeInput = (allowRecovery: boolean) =>
    <TotpCodeField value={code} onChange={setCode} disabled={busy} error={error} allowRecovery={allowRecovery} />;
  const withInput = (totp.enabled && disableMode) || (!totp.enabled && setupOpen && !!qrDataUrl);

  return (
    <section className="aa-group aa-tfa">
      <div className="aa-group-head">
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
          {tr('Защищает аккаунт даже если у тебя украдут Telegram, VK, Яндекс или почту.', 'Защищает аккаунт даже если у вас украдут Telegram, VK, Яндекс или почту.')}
        </div>
      )}

      {totp.enabled && !disableMode && (
        <div className="aa-recovery-row">
          <span className="aa-on"><OkMark />Включена.</span>
          <span className="muted">Резервных кодов осталось: {totp.recoveryCodesLeft}</span>
        </div>
      )}

      {totp.enabled && disableMode && (
        <div className="aa-stack">
          <div className="aa-small">{tr('Введи текущий код из приложения, чтобы отключить:', 'Введите текущий код из приложения, чтобы отключить:')}</div>
          {codeInput(true)}
          <div className="aa-actions">
            <button onClick={disable} disabled={busy || !code.trim()} className="ds-btn ds-btn--secondary" aria-busy={busy || undefined}>
              {busy ? 'Отключаю…' : 'Отключить'}
            </button>
            <button onClick={cancelDisable} disabled={busy} className="ds-link aa-quiet">
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
            <img src={qrDataUrl} alt="QR-код для приложения-аутентификатора" width={200} height={200} />
          </div>
          {otpauthUrl && (
            <details className="aa-small">
              <summary className="u-pointer aa-summary">Не сканируется QR? Ввести секрет вручную<span className="aa-summary-chev" aria-hidden="true"><GlyphChevron /></span></summary>
              <div className="aa-secret">{otpauthUrl}</div>
            </details>
          )}
          {codeInput(false)}
          <div className="aa-actions">
            <button onClick={confirm} disabled={busy || !code.trim()} className="ds-btn ds-btn--secondary" aria-busy={busy || undefined}>
              {busy ? 'Проверяю…' : 'Подтвердить'}
            </button>
            <button onClick={cancelSetup} disabled={busy} className="ds-link aa-quiet">
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && !withInput && <FieldError>{error}</FieldError>}
    </section>
  );
}
