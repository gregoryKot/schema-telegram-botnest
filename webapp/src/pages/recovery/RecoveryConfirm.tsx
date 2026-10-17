import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import { ServicePage } from '../service/ServicePage';
import { ServiceLoading } from '../service/ServiceLoading';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export function RecoveryConfirm({ token }: { token: string }) {
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/recovery/confirm`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? 'Ссылка недействительна или истекла');
        }
        const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
        setAccessToken(accessToken, expiresIn);
        navigate('/account?recovered=1', { replace: true });
      } catch (e) {
        setStatus('error');
        setError(String(e).replace('Error: ', ''));
      }
    })();
  }, [token, setAccessToken, navigate]);

  if (status === 'loading') {
    return <ServiceLoading />;
  }
  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Восстановление</div>
        <h1 className="ds-h2">Не получилось</h1>
        <div className="ds-card as-err">{error}</div>
        <button onClick={() => navigate('/auth/recovery')} className="ds-btn">
          Запросить новую ссылку
        </button>
      </div>
    </ServicePage>
  );
}
