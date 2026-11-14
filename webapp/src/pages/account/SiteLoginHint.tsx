import { getHost } from '../../../../shared/src/host';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { useTr } from '../../utils/addressForm';
import { needsSiteLogin } from '../../../../shared/src/account/siteLoginOffer';
import type { AccountProvider } from './ProviderRows';

/** На сайте, над способами входа: без VK ID и Яндекс ID входа на сайт скоро не останется. */
export function SiteLoginHint({ providers }: { providers: AccountProvider[] }) {
  const tr = useTr();
  const hostId = getHost().id; // в Telegram зовёт SiteAccessCard
  if (hostId !== 'web' || !needsSiteLogin({ providers: providers.map((p) => p.provider), hostId })) return null;
  return (
    <PaperAlert role="status" className="aa-alert" title="На сайт будут входить через VK ID и Яндекс ID"
      text={tr(
        'Вход по почте скоро отключится. Привяжи ниже VK ID или Яндекс ID — аккаунт и записи останутся на месте.',
        'Вход по почте скоро отключится. Привяжите ниже VK ID или Яндекс ID — аккаунт и записи останутся на месте.',
      )} />
  );
}
