import { Skeleton } from '../../components/Skeleton';
import { countMethods, OAUTH_METHODS, unlinkBlockedWhy, type OAuthMethod } from './accountMethods';
import { FrameLinkHint } from './FrameLinkHint';
import { GoogleIcon, MaxIcon, ProviderRow, TelegramIcon, VkIcon, YandexIcon, type AccountProvider, type ProviderId } from './ProviderRows';
import { PROVIDER_NAMES } from './providerNames';
import { useFrameLinkGuard } from './useFrameLinkGuard';

const OAUTH_ICONS: Record<OAuthMethod, typeof VkIcon> = { vk: VkIcon, yandex: YandexIcon };

/** Силуэт строк группы, пока /api/auth/me не ответил: значок, подпись, кнопка. */
export function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="aa-methods" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="aa-row">
          <Skeleton width={36} height={36} radius={10} />
          <Skeleton width="40%" height={14} />
          <Skeleton width={96} height={40} radius={20} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  );
}

/** Группа «Способы входа N из M»: строки провайдеров (плоская, без карточки); почта — в EmailLettersGroup. */
export function SignInMethods({
  providers, userId, loading, busy, onLink, onUnlink,
}: {
  providers: AccountProvider[];
  /** Номер аккаунта из /api/auth/me: аккаунт из Telegram входит через бота и без строки. */
  userId: string | null;
  loading: boolean; busy: boolean;
  onLink: Record<OAuthMethod, () => void>;
  onUnlink: (id: ProviderId) => void;
}) {
  const find = (id: ProviderId) => providers.find((p) => p.provider === id);
  const { linked, total } = countMethods(providers);
  const why = (id: ProviderId) => unlinkBlockedWhy(providers, id, userId);
  const frame = useFrameLinkGuard(onLink);

  return (
    <section className="aa-group">
      <div className="aa-group-head">
        <h2 className="ds-h3">Способы входа</h2>
        {!loading && <span className="ds-sub">{linked} из {total}</span>}
      </div>
      {loading ? <RowsSkeleton rows={2} /> : (
        <div className="aa-methods">
          {/* Google: вход убран в 2026-11 — строка только у привязавших раньше, без «Привязать». */}
          {find('google') && <ProviderRow icon={<GoogleIcon />} title="Google" linked busy={busy}
            subtitle={find('google')?.email} unlinkBlockedWhy={why('google')} onUnlink={() => onUnlink('google')} />}
          {/* Telegram: входа на сайт через него нет (2026-11) — без «Привязать»; бота подключает AccountLinkSection. */}
          {find('telegram') && <ProviderRow icon={<TelegramIcon />} title="Telegram" linked busy={busy}
            subtitle={find('telegram')?.displayName ?? 'привязан'} unlinkBlockedWhy={why('telegram')}
            onUnlink={() => onUnlink('telegram')} />}
          {/* ВКонтакте и Яндекс: строка одна, различия — данные (OAUTH_METHODS, по нему же счётчик «N из M»); во фрейме мессенджера «Привязать» — подсказка. */}
          {OAUTH_METHODS.map((id) => {
            const row = find(id);
            const Icon = OAUTH_ICONS[id];
            return <ProviderRow key={id} icon={<Icon />} title={PROVIDER_NAMES[id]} linked={!!row} busy={busy}
              subtitle={row?.displayName ?? row?.email ?? 'привязан'} unlinkBlockedWhy={why(id)}
              onLink={frame.link(id)} onUnlink={() => onUnlink(id)} />;
          })}
          {/* MAX: входа для сайтов у площадки нет — привязка начинается в самом приложении. */}
          {find('max') && (
            <ProviderRow icon={<MaxIcon />} title="MAX" linked busy={busy}
              subtitle={find('max')?.displayName ?? 'привязан'} unlinkBlockedWhy={why('max')}
              onUnlink={() => onUnlink('max')} />
          )}
        </div>
      )}
      {frame.hint && <FrameLinkHint {...frame.hint} />}
    </section>
  );
}
