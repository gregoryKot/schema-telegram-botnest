import { getHost } from '../../../../shared/src/host';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { useTr } from '../../utils/addressForm';
import { needsSiteLogin } from '../../../../shared/src/account/siteLoginOffer';
import type { AccountProvider } from './ProviderRows';

/** На сайте, над способами входа: вход по почте отключён, на сайт входят через VK ID, Яндекс ID и MAX. */
export function SiteLoginHint({ providers }: { providers: AccountProvider[] }) {
  const tr = useTr();
  const hostId = getHost().id; // в Telegram зовёт SiteAccessCard
  if (hostId !== 'web' || !needsSiteLogin({ providers: providers.map((p) => p.provider), hostId })) return null;
  return (
    <PaperAlert role="status" className="aa-alert" title="На сайт входят через VK ID, Яндекс ID и MAX"
      text={tr(
        'Вход по почте отключён. Привяжи ниже VK ID или Яндекс ID — ими и будешь входить на сайт. Аккаунт и записи останутся на месте.',
        'Вход по почте отключён. Привяжите ниже VK ID или Яндекс ID — ими и будете входить на сайт. Аккаунт и записи останутся на месте.',
      )} />
  );
}
