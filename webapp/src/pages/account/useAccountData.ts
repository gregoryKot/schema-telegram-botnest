import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../utils/apiBase';
import type { AccountProvider } from './ProviderRows';

export interface TotpState { enabled: boolean; recoveryCodesLeft: number }

/** Загрузка /api/auth/me: способы входа и состояние 2FA. */
export function useAccountData(accessToken: string | null) {
  const [providers, setProviders] = useState<AccountProvider[]>([]);
  const [totp, setTotp] = useState<TotpState>({ enabled: false, recoveryCodesLeft: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Чистый fetch (без setState): общий для эффекта монтирования и ручного refresh.
  const loadAccount = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to load account');
    return await res.json() as { providers: AccountProvider[]; totp?: TotpState };
  }, [accessToken]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await loadAccount();
      setProviders(data.providers);
      if (data.totp) setTotp(data.totp);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Смена токена — снова «загрузка» (правка во время рендера, не в эффекте).
  const [seenToken, setSeenToken] = useState(accessToken);
  if (accessToken !== seenToken) { setSeenToken(accessToken); setLoading(true); }

  useEffect(() => {
    let alive = true;
    loadAccount()
      .then((data) => { if (alive) { setProviders(data.providers); if (data.totp) setTotp(data.totp); } })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadAccount]);

  return { providers, totp, loading, error, setError, refresh };
}
