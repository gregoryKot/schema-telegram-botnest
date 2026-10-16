import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTr } from '../utils/addressForm';
import { ServicePage } from './service/ServicePage';
import { RecoveryConfirm } from './recovery/RecoveryConfirm';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Two modes:
//   /auth/recovery        — request form (anyone, no auth needed)
//   /auth/recovery/confirm?token=... — consume magic link, log user in
export function RecoveryPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  return token ? <RecoveryConfirm token={token} /> : <RecoveryRequest />;
}

function RecoveryRequest() {
  const navigate = useNavigate();
  const tr = useTr();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/recovery/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Не удалось отправить письмо');
      }
      setSent(true);
    } catch (e) { setError(String(e).replace('Error: ', '')); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <ServicePage>
        <div className="as-body">
          <div className="ds-eyebrow">Восстановление</div>
          <h1 className="ds-h2">{tr('Проверь почту', 'Проверьте почту')}</h1>
          <p className="as-lead">
            Если этот email привязан к аккаунту — на него отправлено письмо со ссылкой.
            Ссылка действует 30 минут. {tr('Не пришло? Проверь спам.', 'Не пришло? Проверьте спам.')}
          </p>
          <button onClick={() => navigate('/login')} className="ds-btn ds-btn--secondary">
            На страницу входа
          </button>
        </div>
      </ServicePage>
    );
  }

  return (
    <ServicePage>
      <div className="as-body">
      <div className="ds-eyebrow">Восстановление доступа</div>
      <h1 className="ds-h2">Нет доступа к аккаунту?</h1>
      <p className="as-lead">
        {tr(
          'Если запасная почта для восстановления уже указана — введи её, мы пришлём ссылку для входа.',
          'Если запасная почта для восстановления уже указана — введите её, мы пришлём ссылку для входа.',
        )}{' '}
        Иначе доступ к аккаунту восстановить нельзя.
      </p>
      <form onSubmit={submit} className="as-form">
        <input
          type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com" className="ds-input"
        />
        {error && <div className="ds-card as-err">{error}</div>}
        <button type="submit" disabled={busy || !email.trim()} className="ds-btn">
          {busy ? 'Отправляю…' : 'Отправить ссылку'}
        </button>
      </form>
      </div>
    </ServicePage>
  );
}
