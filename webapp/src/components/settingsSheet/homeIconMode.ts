import { getHost } from '../../../../shared/src/host';
import { canOfferHomeScreenNow } from '../../../../shared/src/host/homeScreen';
import { isStandalone } from '../../utils/pwaInstall';

// Как человеку поставить значок на экран — зависит от того, где открыт сайт:
//  messenger — внутри Telegram/MAX с рабочим addToHomeScreen: та же кнопка,
//              что в карточке «Держи под рукой» на «Сегодня»;
//  browser   — обычная вкладка браузера: установка PWA (нативный промпт
//              Chromium или шаги руками для Safari);
//  null      — значок не нужен или поставить нечем (уже установлено, мессенджер
//              без поддержки).
export type HomeIconMode = 'messenger' | 'browser' | null;

export function pickHomeIconMode(o: {
  hostId: string;
  canOfferInMessenger: boolean;
  standalone: boolean;
}): HomeIconMode {
  if (o.hostId !== 'web') return o.canOfferInMessenger ? 'messenger' : null;
  return o.standalone ? null : 'browser';
}

export function homeIconMode(): HomeIconMode {
  return pickHomeIconMode({
    hostId: getHost().id,
    canOfferInMessenger: canOfferHomeScreenNow(),
    standalone: isStandalone(),
  });
}
