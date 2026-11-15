import { useState } from 'react';
import { messengerFrame } from '../../../../shared/src/host/messengerFrame';
import type { OAuthMethod } from './accountMethods';
import type { FrameLinkHintProps } from './FrameLinkHint';

/** «Привязать» во фрейме мессенджера оборвался бы молча — вместо перехода запоминаем подсказку (FrameLinkHint). */
export function useFrameLinkGuard(onLink: Record<OAuthMethod, () => void>) {
  const [hint, setHint] = useState<FrameLinkHintProps | null>(null);
  const link = (method: OAuthMethod) => () => {
    const messenger = messengerFrame();
    if (messenger) setHint({ method, messenger });
    else onLink[method]();
  };
  return { link, hint };
}
