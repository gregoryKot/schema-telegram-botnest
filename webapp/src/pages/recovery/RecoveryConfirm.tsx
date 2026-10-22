import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import { ServicePage } from '../service/ServicePage';
import { ServiceLoading } from '../service/ServiceLoading';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const LINK_INVALID = 'Ссылка недействительна или истекла';

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
        if (!res.ok) throw new Error((await readHumanError(res, LINK_INVALID)).message);
        const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
        setAccessToken(accessToken, expiresIn);
        navigate('/account?recovered=1', { replace: true });
      } catch (e) {
        setStatus('error');
        setError(humanizeThrown(e, LINK_INVALID));
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
