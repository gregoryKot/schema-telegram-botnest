import { useState } from 'react';
import { API_BASE } from '../../utils/apiBase';
import type { ProviderId } from './ProviderRows';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';

// Подписи провайдеров для диалога отвязки (Ж4): по реальному провайдеру.
export const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: 'Google',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
  max: 'MAX',
  email: 'Email',
};

const UNLINK_FAILED = 'Не удалось отвязать способ входа';

/** Привязка (link-token кука → редирект) и отвязка провайдеров. */
export function useProviderActions(
  accessToken: string | null,
  refresh: () => Promise<void>,
  setError: (m: string | null) => void,
) {
  const [busy, setBusy] = useState(false);
  const [unlinkProvider, setUnlinkProvider] = useState<ProviderId | null>(null);

  // Запрос ставит httpOnly-cookie `link_token` (60 c) — токен не в URL.
  const fetchLinkToken = async (): Promise<void> => {
    await fetch(`${API_BASE}/api/auth/link-token`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken ?? ''}` },
    });
  };
  // Общий шаг привязки для всех OAuth-провайдеров: сначала link-token кука
  // (без неё сервер не видит юзера и создаёт ДРУГОЙ аккаунт, 2026-08-21), потом редирект.
  const linkVia = async (path: string) => {
    sessionStorage.setItem('auth_return_to', '/account');
    await fetchLinkToken();
    window.location.href = `${API_BASE}${path}`;
  };

  const performUnlink = async (provider: ProviderId) => {
    setUnlinkProvider(null);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/unlink/${provider}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-requested-with': 'webapp', Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error((await readHumanError(res, UNLINK_FAILED)).message);
      await refresh();
    } catch (e) {
      setError(humanizeThrown(e, UNLINK_FAILED));
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    unlinkProvider,
    setUnlinkProvider,
    performUnlink,
    linkGoogle: () => linkVia('/api/auth/google'),
    linkVk: () => linkVia('/api/auth/vk'),
    linkTelegram: () => linkVia('/api/auth/telegram/redirect'),
  };
}
