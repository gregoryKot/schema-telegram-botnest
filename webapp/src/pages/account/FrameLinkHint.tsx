import type { FrameMessenger } from '../../../../shared/src/host/messengerFrame';
import { PaperAlert } from '../../components/paper/PaperAlert';
import { useTr } from '../../utils/addressForm';
import type { OAuthMethod } from './accountMethods';
import { PROVIDER_NAMES } from './providerNames';

export interface FrameLinkHintProps {
  method: OAuthMethod;
  messenger: FrameMessenger;
}

const ID_NAMES: Record<OAuthMethod, string> = { vk: 'VK ID', yandex: 'Яндекс ID' };

/** Ответ на «Привязать» в веб-версии мессенджера: переход там обрывается, поэтому — где привязать. */
export function FrameLinkHint({ method, messenger }: FrameLinkHintProps) {
  const tr = useTr();
  const id = ID_NAMES[method];
  const app = PROVIDER_NAMES[messenger];
  return (
    <PaperAlert role="status" title={`${id} отсюда не привязать`} text={tr(
      `В веб-версии ${app} страница ${id} не открывается. Открой «Всё по схеме» в приложении ${app} на телефоне или компьютере и привяжи ${id} в «Аккаунте».`,
      `В веб-версии ${app} страница ${id} не открывается. Откройте «Всё по схеме» в приложении ${app} на телефоне или компьютере и привяжите ${id} в «Аккаунте».`,
    )} />
  );
}
