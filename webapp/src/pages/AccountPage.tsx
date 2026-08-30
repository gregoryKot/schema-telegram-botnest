import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

import { API_BASE } from '../utils/apiBase';
import { useTr } from '../utils/addressForm'; import { TherapistRequestSection } from './account/TherapistRequestSection';
import { TwoFactorSection } from './account/TwoFactorSection';
import { GoogleIcon, MaxIcon, ProviderRow, TelegramIcon, VkIcon, type AccountProvider } from './account/ProviderRows';
import { Skeleton } from '../components/Skeleton';
import { AccountLinkSection } from './account/AccountLinkSection';
import { EmailLinkRow } from './account/EmailLinkRow';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Provider = AccountProvider;

// Ж4: подписи провайдеров для диалога отвязки — раньше сообщение всегда
// говорило либо «Google», либо «Telegram» (VK/MAX/Email молча получали
// «Telegram» из тернарника) — теперь по реальному провайдеру.
const PROVIDER_LABELS: Record<Provider['provider'], string> = {
  google: 'Google',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
  max: 'MAX',
  email: 'Email',
};

export function AccountPage() {
  const { accessToken, logout } = useAuth();
  const tr = useTr(); const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [totp, setTotp] = useState<{ enabled: boolean; recoveryCodesLeft: number }>({ enabled: false, recoveryCodesLeft: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const success = searchParams.get('linked') === 'email' ? '✓ Email успешно привязан' : null;
  // Переход по ссылке из письма на занятый адрес. Раньше он уводил на экран
  // «ссылка истекла» — неправда: ссылка жива, занят адрес, и человек шёл
  // запрашивать письмо заново по кругу.
  const emailTaken = searchParams.get('error') === 'email_taken'
    ? tr('Этот адрес уже привязан к другому аккаунту. Войди по нему на странице входа — или привяжи сюда другой адрес.',
         'Этот адрес уже привязан к другому аккаунту. Войдите по нему на странице входа — или привяжите сюда другой адрес.')
    : null;
  const [busy, setBusy] = useState(false);

  // Pure fetch (no setState), so it can be shared by the mount effect and the
  // manual refresh without either duplicating the request.
  const loadAccount = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to load account');
    return await res.json() as { providers: Provider[]; totp?: { enabled: boolean; recoveryCodesLeft: number } };
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

  // Re-show loading when the token changes (adjust during render, not in an
  // effect); on mount `loading` already starts true.
  const [seenToken, setSeenToken] = useState(accessToken);
  if (accessToken !== seenToken) { setSeenToken(accessToken); setLoading(true); }

  // Load account on mount / token change. Fetch lives inside the effect, guarded
  // by `alive`, so nothing sets state synchronously and deps are complete.
  useEffect(() => {
    let alive = true;
    loadAccount()
      .then((data) => { if (alive) { setProviders(data.providers); if (data.totp) setTotp(data.totp); } })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadAccount]);

  // Запрос ставит httpOnly-cookie `link_token` (60 c) — токен больше не
  // передаётся в URL (не попадает в логи/историю браузера).
  const fetchLinkToken = async (): Promise<void> => {
    await fetch(`${API_BASE}/api/auth/link-token`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken ?? ''}` },
    });
  };
  // Общий шаг привязки: одна и та же механика для всех OAuth-провайдеров
  // (сначала link-token кука, потом редирект) — раньше linkTelegram копией не
  // делал await fetchLinkToken() (симптом 2026-08-21: без куки сервер не
  // видел юзера, вместо привязки создавался/логинился ДРУГОЙ аккаунт).
  const linkVia = async (path: string) => {
    sessionStorage.setItem('auth_return_to', '/account');
    await fetchLinkToken();
    window.location.href = `${API_BASE}${path}`;
  };
  const linkGoogle = () => linkVia('/api/auth/google');
  const linkVk = () => linkVia('/api/auth/vk');
  const linkTelegram = () => linkVia('/api/auth/telegram/redirect');

  // Ж4 (аудит 2026-08): нативный confirm() заменён на ConfirmDialog —
  // unlinkProvider хранит, какой провайдер подтверждаем (null = диалог закрыт).
  const [unlinkProvider, setUnlinkProvider] = useState<Provider['provider'] | null>(null);

  const performUnlink = async (provider: Provider['provider']) => {
    setUnlinkProvider(null);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/unlink/${provider}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-requested-with': 'webapp', Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Unlink failed' }));
        throw new Error(body.message ?? 'Unlink failed');
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const hasGoogle = providers.some(p => p.provider === 'google');
  const hasTelegram = providers.some(p => p.provider === 'telegram');
  const hasVk = providers.some(p => p.provider === 'vk');
  const hasEmail = providers.some(p => p.provider === 'email');
  const hasMax = providers.some(p => p.provider === 'max');

  return (
    <div style={{ flex: 1, padding: 24, maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <button onClick={() => navigate('/today')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, marginBottom: 16, cursor: 'pointer', padding: 0 }}>
        ← Назад
      </button>

      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 8 }}>Аккаунт</h1>
      <p style={{ color: 'var(--text-sub)', fontSize: 14, marginBottom: 24 }}>
        {tr('Привязывай несколько способов входа – заходи откуда удобно', 'Привязывайте несколько способов входа – заходите откуда удобно')}
      </p>

      {success && (
        <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 'var(--r-12)', padding: 12, marginBottom: 16, color: 'var(--accent-green)', fontSize: 13 }}>
          {success}
        </div>
      )}

      {(error ?? emailTaken) && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--r-12)', padding: 12, marginBottom: 16, color: 'var(--accent-red)', fontSize: 13 }}>
          {error ?? emailTaken}
        </div>
      )}

      <AccountLinkSection providers={providers} loading={loading} onLinked={refresh} />

      {loading ? (
        // Силуэт будущих строк входа: иконка, название, кнопка. Правило
        // проекта — плейсхолдер ПО ФОРМЕ контента, а не крутилка.
        <div className="card-elevated" style={{ padding: 20 }} aria-hidden>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: '14px 0' }}>
              <Skeleton width={36} height={36} radius={10} />
              <Skeleton width="40%" height={14} />
              <Skeleton width={84} height={30} radius={8} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card-elevated" style={{ padding: '20px' }}>
          <ProviderRow icon={<GoogleIcon />} title="Google" divider linked={hasGoogle} busy={busy}
            subtitle={providers.find(p => p.provider === 'google')?.email}
            onLink={linkGoogle} onUnlink={() => setUnlinkProvider('google')} />

          <ProviderRow icon={<TelegramIcon />} title="Telegram" linked={hasTelegram} busy={busy}
            subtitle={providers.find(p => p.provider === 'telegram')?.displayName ?? 'привязан'}
            onLink={linkTelegram} onUnlink={() => setUnlinkProvider('telegram')} />

          <ProviderRow icon={<VkIcon />} title="ВКонтакте" divider linked={hasVk} busy={busy}
            subtitle={providers.find(p => p.provider === 'vk')?.displayName ?? providers.find(p => p.provider === 'vk')?.email ?? 'привязан'}
            onLink={linkVk} onUnlink={() => setUnlinkProvider('vk')} />

          {/* MAX: своего входа для сайтов у площадки нет — привязка начинается
              в самом приложении, поэтому кнопки «Привязать» здесь быть не может. */}
          {hasMax && (
            <ProviderRow icon={<MaxIcon />} title="MAX" divider linked busy={busy}
              subtitle={providers.find(p => p.provider === 'max')?.displayName ?? 'привязан'}
              onUnlink={() => setUnlinkProvider('max')} />
          )}

          <EmailLinkRow accessToken={accessToken} linked={hasEmail} busy={busy}
            email={providers.find(p => p.provider === 'email')?.email}
            onUnlink={() => setUnlinkProvider('email')} onError={setError} />
        </div>
      )}

      <TwoFactorSection accessToken={accessToken} totp={totp} onChanged={refresh} />

      <TherapistRequestSection accessToken={accessToken} />

      <button onClick={() => logout()} style={{ marginTop: 24, width: '100%', background: 'transparent', border: '1px solid rgba(var(--fg-rgb),0.15)', color: 'var(--text-sub)', borderRadius: 'var(--r-12)', padding: '14px 0', fontSize: 14, cursor: 'pointer' }}>
        Выйти
      </button>

      {unlinkProvider && (
        <ConfirmDialog
          title={`Отвязать ${PROVIDER_LABELS[unlinkProvider]}?`}
          message="Понадобится другой способ входа в аккаунт."
          confirmLabel="Отвязать"
          busy={busy}
          onConfirm={() => performUnlink(unlinkProvider)}
          onCancel={() => setUnlinkProvider(null)}
        />
      )}
    </div>
  );
}
