import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { OtpCells } from './login/OtpCells';
import { RecoveryCodeField } from './login/RecoveryCodeField';
import { TwoFactorIntro } from './login/TwoFactorIntro';
import { TwoFactorExpired } from './login/TwoFactorExpired';
import { submitTwoFactorCode } from './login/twoFactorSubmit';
import { useChallengeAddress } from './login/useChallengeAddress';
import { AuthShell } from './login/AuthShell';
import { SignHero } from '../components/paper/SignHero';
import { PaperAlert } from '../components/paper/PaperAlert';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Page the user lands on after primary login (Google/Telegram/VK) IF their
// account has TOTP enabled. They paste a 6-digit code (or a recovery code)
// to exchange the challenge token for a real session (address: useChallengeAddress).
export function TwoFactorChallengePage() {
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [expired, setExpired] = useState(false);
  const { challengeToken, afterLogin } = useChallengeAddress();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!challengeToken) { navigate('/login', { replace: true }); return; }
    inputRef.current?.focus();
  }, [challengeToken, navigate]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    const out = await submitTwoFactorCode(API_BASE, challengeToken, code.trim());
    if (out.kind === 'ok') { setAccessToken(out.accessToken, out.expiresIn); navigate(afterLogin, { replace: true }); return; }
    setBusy(false);
    setCode('');
    if (out.kind === 'expired') { setExpired(true); return; }
    setError(out.message);
    inputRef.current?.focus();
  };

  const switchMode = () => { setRecovery(r => !r); setCode(''); setError(null); };
  useEffect(() => { inputRef.current?.focus(); }, [recovery]);

  // Протух — исход на весь экран: «код из приложения» над «войти заново» сбивает.
  if (expired) return <TwoFactorExpired />;

  return (
    <AuthShell hue={240} className="al-2fa" art={<SignHero sign="limits" />}>
      <TwoFactorIntro />
      <form onSubmit={submit} className="al-form">
        {recovery ? (
          <RecoveryCodeField ref={inputRef} value={code} onChange={setCode} disabled={busy} />
        ) : (
          <OtpCells ref={inputRef} value={code} onChange={setCode} disabled={busy} label="Код из приложения" />
        )}
        {error && <PaperAlert title={error} className="al-alert" />}
        <button type="submit" disabled={busy || !code.trim()} aria-busy={busy || undefined} className="al-submit">
          {busy ? 'Проверяю…' : 'Подтвердить'}
        </button>
        <p className="al-foot al-foot--center">
          {recovery ? 'Есть телефон? ' : 'Нет телефона? '}
          <button type="button" className="al-linkbtn" onClick={switchMode}>
            {recovery ? 'Ввести код из приложения' : 'Ввести резервный код'}
          </button>
        </p>
      </form>
    </AuthShell>
  );
}
