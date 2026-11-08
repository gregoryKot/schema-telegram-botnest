import { useState } from 'react';
import { API_BASE } from '../../utils/apiBase';
import type { ProviderId } from './ProviderRows';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';
import { stepUpHeader } from '../../../../shared/src/auth/stepUp';
import { useStepUpFetch } from '../../components/stepUp/stepUpContext';
import { sessionPost } from '../../components/stepUp/sessionRequest';

const UNLINK_FAILED = 'Не удалось отвязать способ входа';
const LINK_FAILED = 'Не удалось начать привязку';

/** Привязка (link-token кука → редирект) и отвязка провайдеров; при 2FA — с кодом (S12). */
export function useProviderActions(
  accessToken: string | null,
  refresh: () => Promise<void>,
  setError: (m: string | null) => void,
) {
  const [busy, setBusy] = useState(false);
  const [unlinkProvider, setUnlinkProvider] = useState<ProviderId | null>(null);
  const stepUp = useStepUpFetch();

  // Привязка OAuth: сначала httpOnly-кука `link_token` (60 c; без неё сервер создаёт ДРУГОЙ
  // аккаунт, 2026-08-21), потом редирект. Куки нет (окно кода закрыто, сбой) — не уходим.
  const linkVia = async (path: string) => {
    setError(null);
    try {
      const res = await stepUp((code) => fetch(`${API_BASE}/api/auth/link-token`, {
        credentials: 'include', headers: { Authorization: `Bearer ${accessToken ?? ''}`, ...stepUpHeader(code) } }));
      if (!res) return;
      if (!res.ok) throw new Error((await readHumanError(res, LINK_FAILED)).message);
      sessionStorage.setItem('auth_return_to', '/account');
      window.location.href = `${API_BASE}${path}`;
    } catch (e) {
      setError(humanizeThrown(e, LINK_FAILED));
    }
  };

  const performUnlink = async (provider: ProviderId) => {
    setUnlinkProvider(null);
    setBusy(true);
    setError(null);
    try {
      const res = await stepUp(sessionPost(`/api/auth/unlink/${provider}`, accessToken));
      if (res && !res.ok) throw new Error((await readHumanError(res, UNLINK_FAILED)).message);
      if (res) await refresh();
    } catch (e) {
      setError(humanizeThrown(e, UNLINK_FAILED));
    } finally {
      setBusy(false);
    }
  };

  return {
    busy, unlinkProvider, setUnlinkProvider, performUnlink,
    linkGoogle: () => linkVia('/api/auth/google'),
    linkVk: () => linkVia('/api/auth/vk'),
    linkTelegram: () => linkVia('/api/auth/telegram/redirect'),
  };
}
