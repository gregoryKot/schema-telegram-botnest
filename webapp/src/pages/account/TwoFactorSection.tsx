import { useState } from 'react';
import { API_BASE } from '../../utils/apiBase'; import { useTr } from '../../utils/addressForm';

// Секция двухфакторной аутентификации (TOTP). Вынесено из AccountPage.tsx
// (правило №10).
export function TwoFactorSection({
  accessToken, totp, onChanged,
}: {
  accessToken: string | null;
  totp: { enabled: boolean; recoveryCodesLeft: number };
  onChanged: () => void;
}) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Не удалось начать настройку');
      const data = await res.json() as { qrDataUrl: string; otpauthUrl: string };
      setQrDataUrl(data.qrDataUrl);
      setOtpauthUrl(data.otpauthUrl);
      setSetupOpen(true);
    } catch (e) { setError(String(e).replace('Error: ', '')); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/enable`, {
        method: 'POST', credentials: 'include', headers: csrfHeaders(),
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Неверный код');
      const data = await res.json() as { recoveryCodes: string[] };
      setRecoveryCodes(data.recoveryCodes);
      setCode('');
      setQrDataUrl(null);
      onChanged();
    } catch (e) { setError(String(e).replace('Error: ', '')); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/disable`, {
        method: 'POST', credentials: 'include', headers: csrfHeaders(),
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Неверный код');
      setCode('');
      setDisableMode(false);
      onChanged();
    } catch (e) { setError(String(e).replace('Error: ', '')); }
    finally { setBusy(false); }
  };

  if (recoveryCodes) {
    return (
      <div style={{ marginTop: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Recovery-коды</div>
        <div className="text-sm muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>
          {tr('Сохрани эти коды в надёжном месте (пароль-менеджер). Каждый можно использовать один раз вместо TOTP-кода, если потеряешь телефон.', 'Сохраните эти коды в надёжном месте (пароль-менеджер). Каждый можно использовать один раз вместо TOTP-кода, если потеряете телефон.')}
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 14, lineHeight: 2,
          padding: '14px 18px', background: 'var(--surface-2)', borderRadius: 'var(--r-10)',
          letterSpacing: '0.05em', columnCount: 2, columnGap: 24,
        }}>
          {recoveryCodes.map(c => <div key={c}>{c}</div>)}
        </div>
        <button onClick={() => setRecoveryCodes(null)} className="btn btn-secondary" style={{ marginTop: 14 }}>
          Готово, коды сохранены
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Двухфакторная аутентификация</div>

      {!totp.enabled && !setupOpen && (
        <div className="text-sm muted" style={{ lineHeight: 1.6, marginBottom: 14 }}>
          Дополнительный код из приложения (Google Authenticator, 1Password, …) при каждом входе.{' '}
          {tr('Защищает аккаунт даже если у тебя украдут Google/Telegram/VK.', 'Защищает аккаунт даже если у вас украдут Google/Telegram/VK.')}
        </div>
      )}

      {totp.enabled && !disableMode && (
        <>
          <div className="text-sm" style={{ marginBottom: 14 }}>
            <span style={{ color: 'var(--c-moss)' }}>✓ Включена.</span>{' '}
            <span className="muted">Recovery-кодов осталось: {totp.recoveryCodesLeft}</span>
          </div>
          <button onClick={() => setDisableMode(true)} className="btn btn-secondary" disabled={busy}>
            Отключить 2FA
          </button>
        </>
      )}

      {totp.enabled && disableMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
          <div className="text-sm muted">{tr('Введи текущий код из приложения, чтобы отключить:', 'Введите текущий код из приложения, чтобы отключить:')}</div>
          <input
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
            style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r-10)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-10)' }}>
            <button onClick={disable} disabled={busy || !code.trim()} className="btn btn-primary">
              {busy ? 'Отключаю…' : 'Отключить'}
            </button>
            <button onClick={() => { setDisableMode(false); setCode(''); setError(null); }} disabled={busy} className="btn btn-secondary">
              Отмена
            </button>
          </div>
        </div>
      )}

      {!totp.enabled && !setupOpen && (
        <button onClick={startSetup} disabled={busy} className="btn btn-primary">
          {busy ? 'Подготавливаю…' : 'Включить 2FA'}
        </button>
      )}

      {!totp.enabled && setupOpen && qrDataUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-14)', marginTop: 8 }}>
          <div className="text-sm muted" style={{ lineHeight: 1.6 }}>
            {tr('1. Установи приложение-аутентификатор (Google Authenticator, 1Password, Bitwarden, Authy).', '1. Установите приложение-аутентификатор (Google Authenticator, 1Password, Bitwarden, Authy).')}<br/>
            {tr('2. Отсканируй QR. Или введи секрет вручную из ссылки ниже.', '2. Отсканируйте QR. Или введите секрет вручную из ссылки ниже.')}<br/>
            {tr('3. Введи 6-значный код из приложения, чтобы завершить.', '3. Введите 6-значный код из приложения, чтобы завершить.')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12, background: 'white', borderRadius: 'var(--r-10)', alignSelf: 'flex-start' }}>
            <img src={qrDataUrl} alt="TOTP QR" width={200} height={200} />
          </div>
          {otpauthUrl && (
            <details className="text-sm muted">
              <summary style={{ cursor: 'pointer' }}>Не сканируется QR? Ввести секрет вручную</summary>
              <div style={{ marginTop: 6, padding: 10, background: 'var(--surface-2)', borderRadius: 'var(--r-8)', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 11 }}>
                {otpauthUrl}
              </div>
            </details>
          )}
          <input
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
            style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--r-10)', background: 'var(--surface)', color: 'var(--text)', fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-10)' }}>
            <button onClick={confirm} disabled={busy || !code.trim()} className="btn btn-primary">
              {busy ? 'Проверяю…' : 'Подтвердить'}
            </button>
            <button onClick={() => { setSetupOpen(false); setQrDataUrl(null); setCode(''); setError(null); }} disabled={busy} className="btn btn-secondary">
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm" style={{ color: 'var(--c-rose)', marginTop: 10 }}>{error}</div>
      )}
    </div>
  );
}
