import { useCallback, useEffect, useState } from 'react';
import { getHost } from '../../../shared/src/host';
import { api } from '../api';
import {
  getOfferMemory,
  homeScreenPlatform,
  markHomeScreenAdded,
  markHomeScreenNever,
  shouldOfferHomeScreen,
  snoozeHomeScreen,
  type TgHomeScreenStatus,
} from '../utils/homeScreen';

export type OfferSurface = 'onboarding' | 'today' | 'settings';

// Предложение «добавить значок на экран» — одно на все места показа
// (шаг онбординга, карточка-напоминание, настройки), чтобы память об отказе
// и снузе была общей. Логика «показывать ли» — чистая, в utils/homeScreen.
export function useHomeScreenOffer(surface: OfferSurface) {
  const host = getHost();
  const platform = homeScreenPlatform(host.platform);
  const [status, setStatus] = useState<TgHomeScreenStatus | undefined>();
  const [dismissed, setDismissed] = useState(false);

  // Статус значка спрашиваем у хоста, а не у человека: он мог добавить
  // приложение с другого устройства или снести значок с экрана.
  useEffect(() => {
    host.homeScreen.checkStatus((s) => setStatus(s));
    return host.homeScreen.onAdded(() => {
      markHomeScreenAdded();
      setStatus('added');
      api.trackEvent('home_screen_offer', { action: 'added', surface });
    });
  }, [host, surface]);

  const visible =
    !dismissed &&
    shouldOfferHomeScreen({
      platform: host.platform,
      hasApi: host.capabilities.homeScreen,
      tgStatus: status,
      memory: getOfferMemory(),
      now: Date.now(),
    });

  useEffect(() => {
    if (visible)
      api.trackEvent('home_screen_offer', { action: 'shown', surface });
  }, [visible, surface]);

  return {
    visible,
    platform,
    /** Побочные действия после активации кнопки (сам триггер — в
     * AddHomeScreenButton): снуз на неделю, событие, скрыть карточку. */
    noteAddTriggered: useCallback(() => {
      snoozeHomeScreen();
      setDismissed(true);
      api.trackEvent('home_screen_offer', { action: 'add', surface });
    }, [surface]),
    later: useCallback(() => {
      api.trackEvent('home_screen_offer', { action: 'later', surface });
      snoozeHomeScreen();
      setDismissed(true);
    }, [surface]),
    never: useCallback(() => {
      api.trackEvent('home_screen_offer', { action: 'never', surface });
      markHomeScreenNever();
      setDismissed(true);
    }, [surface]),
  };
}
