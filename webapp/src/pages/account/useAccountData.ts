import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../utils/apiBase';
import { reportClientError } from '../../api';
import { ApiError } from '../../apiClient';
import type { AccountProvider } from './ProviderRows';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';
import { describeFailure } from '../../../../shared/src/api/describeFailure';

export interface TotpState { enabled: boolean; recoveryCodesLeft: number }
interface AccountData { userId?: string; providers: AccountProvider[]; totp?: TotpState }
const LOAD_FAILED = 'Не удалось загрузить способы входа';

/** Способы входа не загрузились — экран-тупик шлёт отчёт наверх (№14): статус или тип сбоя, без текста ответа. */
function reportLoadFailure(e: unknown) {
  reportClientError({ message: `account load failed: ${describeFailure(e)}`, section: 'account' });
}

/** Загрузка /api/auth/me: номер аккаунта (правило отвязки), способы входа и состояние 2FA. */
export function useAccountData(accessToken: string | null) {
  const [providers, setProviders] = useState<AccountProvider[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [totp, setTotp] = useState<TotpState>({ enabled: false, recoveryCodesLeft: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Чистый fetch (без setState): общий для эффекта монтирования и ручного refresh.
  const loadAccount = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    // Статус в ошибке — для отчёта наверх; текст на экране тот же: он уже человеческий.
    if (!res.ok) throw new ApiError(res.status, (await readHumanError(res, LOAD_FAILED)).message);
    return await res.json() as AccountData;
  }, [accessToken]);

  const apply = useCallback((data: AccountData) => {
    setProviders(data.providers);
    setUserId(data.userId ?? null);
    if (data.totp) setTotp(data.totp);
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      apply(await loadAccount());
    } catch (e) { setError(humanizeThrown(e, LOAD_FAILED)); reportLoadFailure(e); }
    finally { setLoading(false); }
  };

  // Смена токена — снова «загрузка» (правка во время рендера, не в эффекте).
  const [seenToken, setSeenToken] = useState(accessToken);
  if (accessToken !== seenToken) { setSeenToken(accessToken); setLoading(true); }

  useEffect(() => {
    let alive = true;
    loadAccount()
      .then((data) => { if (alive) apply(data); })
      .catch((e: unknown) => { if (alive) { setError(humanizeThrown(e, LOAD_FAILED)); reportLoadFailure(e); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadAccount, apply]);

  return { userId, providers, totp, loading, error, setError, refresh };
}
