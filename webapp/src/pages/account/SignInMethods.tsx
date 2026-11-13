import { Skeleton } from '../../components/Skeleton';
import { canUnlink, countMethods, OAUTH_METHODS, type OAuthMethod } from './accountMethods';
import { EmailLinkRow } from './EmailLinkRow';
import type { EmailLinkNotice } from './emailLinkNotice';
import { GoogleIcon, MaxIcon, ProviderRow, TelegramIcon, VkIcon, YandexIcon, type AccountProvider, type ProviderId } from './ProviderRows';
import { PROVIDER_NAMES } from './providerNames';

const OAUTH_ICONS: Record<OAuthMethod, typeof VkIcon> = { vk: VkIcon, yandex: YandexIcon };

/** Группа «Способы входа N из M»: строки провайдеров + привязка email (плоская, без карточки). */
export function SignInMethods({
  providers, loading, busy, accessToken, onLink, onUnlink, emailNotice = null, onLinked,
}: {
  providers: AccountProvider[];
  loading: boolean; busy: boolean;
  accessToken: string | null;
  onLink: Record<OAuthMethod, () => void>;
  onUnlink: (id: ProviderId) => void;
  emailNotice?: EmailLinkNotice | null;
  onLinked: () => void;
}) {
  const find = (id: ProviderId) => providers.find((p) => p.provider === id);
  const { linked, total } = countMethods(providers);
  const only = (id: ProviderId) => !canUnlink(providers, id);

  return (
    <section className="aa-group">
      <div className="aa-group-head">
        <h2 className="ds-h3">Способы входа</h2>
        {!loading && <span className="ds-sub">{linked} из {total}</span>}
      </div>
      {loading ? (
        <div className="aa-methods" aria-hidden>
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
          {/* Telegram: входа на сайт через него нет (2026-11) — без «Привязать»; бота подключает AccountLinkSection. */}
          {find('telegram') && <ProviderRow icon={<TelegramIcon />} title="Telegram" linked busy={busy}
            subtitle={find('telegram')?.displayName ?? 'привязан'} unlinkBlocked={only('telegram')}
            onUnlink={() => onUnlink('telegram')} />}
          {/* ВКонтакте и Яндекс: строка одна, различия — данные (OAUTH_METHODS, по нему же счётчик «N из M»). */}
          {OAUTH_METHODS.map((id) => {
            const row = find(id);
            const Icon = OAUTH_ICONS[id];
            return <ProviderRow key={id} icon={<Icon />} title={PROVIDER_NAMES[id]} linked={!!row} busy={busy}
              subtitle={row?.displayName ?? row?.email ?? 'привязан'} unlinkBlocked={only(id)}
              onLink={onLink[id]} onUnlink={() => onUnlink(id)} />;
          })}
          {/* MAX: входа для сайтов у площадки нет — привязка начинается в самом приложении. */}
          {find('max') && (
            <ProviderRow icon={<MaxIcon />} title="MAX" linked busy={busy}
              subtitle={find('max')?.displayName ?? 'привязан'} unlinkBlocked={only('max')}
              onUnlink={() => onUnlink('max')} />
          )}
          <EmailLinkRow accessToken={accessToken} linked={!!find('email')} busy={busy}
            email={find('email')?.email} unlinkBlocked={only('email')}
            onUnlink={() => onUnlink('email')} notice={emailNotice} onLinked={onLinked} />
        </div>
      )}
    </section>
  );
}
