import { Skeleton } from '../../components/Skeleton';
import { canUnlink, countMethods } from './accountMethods';
import { EmailLinkRow } from './EmailLinkRow';
import { GoogleIcon, MaxIcon, ProviderRow, TelegramIcon, VkIcon, type AccountProvider, type ProviderId } from './ProviderRows';

/** Карточка «Способы входа N из M»: строки провайдеров + привязка email. */
export function SignInMethods({
  providers, loading, busy, accessToken, onLink, onUnlink, onError,
}: {
  providers: AccountProvider[];
  loading: boolean;
  busy: boolean;
  accessToken: string | null;
  onLink: { telegram: () => void; vk: () => void };
  onUnlink: (id: ProviderId) => void;
  onError: (m: string | null) => void;
}) {
  const find = (id: ProviderId) => providers.find((p) => p.provider === id);
  const { linked, total } = countMethods(providers);
  const vk = find('vk');
  const only = (id: ProviderId) => !canUnlink(providers, id);

  return (
    <div className="ds-card aa-card">
      <div className="aa-card-head">
        <h2 className="ds-h3">Способы входа</h2>
        {!loading && <span className="ds-sub">{linked} из {total}</span>}
      </div>
      {loading ? (
        // Силуэт будущих строк: иконка, название, кнопка (не крутилка).
        <div aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aa-row">
              <Skeleton width={36} height={36} radius={10} />
              <Skeleton width="40%" height={14} />
              <Skeleton width={96} height={40} radius={20} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="aa-methods">
          {/* Google: вход убран в 2026-11 — строка только у привязавших раньше, без «Привязать». */}
          {find('google') && <ProviderRow icon={<GoogleIcon />} title="Google" linked busy={busy}
            subtitle={find('google')?.email} unlinkBlocked={only('google')} onUnlink={() => onUnlink('google')} />}
          <ProviderRow icon={<TelegramIcon />} title="Telegram" linked={!!find('telegram')} busy={busy}
            subtitle={find('telegram')?.displayName ?? 'привязан'} unlinkBlocked={only('telegram')}
            onLink={onLink.telegram} onUnlink={() => onUnlink('telegram')} />
          <ProviderRow icon={<VkIcon />} title="ВКонтакте" linked={!!vk} busy={busy}
            subtitle={vk?.displayName ?? vk?.email ?? 'привязан'} unlinkBlocked={only('vk')}
            onLink={onLink.vk} onUnlink={() => onUnlink('vk')} />
          {/* MAX: своего входа для сайтов у площадки нет — привязка начинается
              в самом приложении, поэтому кнопки «Привязать» здесь быть не может. */}
          {find('max') && (
            <ProviderRow icon={<MaxIcon />} title="MAX" linked busy={busy}
              subtitle={find('max')?.displayName ?? 'привязан'} unlinkBlocked={only('max')}
              onUnlink={() => onUnlink('max')} />
          )}
          <EmailLinkRow accessToken={accessToken} linked={!!find('email')} busy={busy}
            email={find('email')?.email} unlinkBlocked={only('email')}
            onUnlink={() => onUnlink('email')} onError={onError} />
        </div>
      )}
    </div>
  );
}
