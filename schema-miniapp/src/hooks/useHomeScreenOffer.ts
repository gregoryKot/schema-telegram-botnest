import { useCallback, useEffect, useState } from 'react';
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
  const tg = window.Telegram?.WebApp;
  const platform = homeScreenPlatform(tg?.platform);
  const [status, setStatus] = useState<TgHomeScreenStatus | undefined>();
  const [dismissed, setDismissed] = useState(false);

  // Статус значка спрашиваем у Telegram, а не у человека: он мог добавить
  // приложение с другого устройства или снести значок с экрана.
  useEffect(() => {
    tg?.checkHomeScreenStatus?.((s) => setStatus(s));
    const onAdded = () => {
      markHomeScreenAdded();
      setStatus('added');
      api.trackEvent('home_screen_offer', { action: 'added', surface });
    };
    tg?.onEvent?.('homeScreenAdded', onAdded);
    return () => tg?.offEvent?.('homeScreenAdded', onAdded);
  }, [tg, surface]);

  const visible =
    !dismissed &&
    shouldOfferHomeScreen({
      platform: tg?.platform,
      hasApi: !!tg?.addToHomeScreen,
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
    /** Нажал «Добавить»: дальше ведёт Telegram, факт добавления придёт событием. */
    add: useCallback(() => {
      // addToHomeScreen ПЕРВЫМ, прямо в user-gesture. На iOS нативный вызов
      // должен идти синхронно в обработчике тапа; предшествующий api.trackEvent
      // (fetch) «съедает» жест, и Telegram молча не открывает экран — из-за
      // этого кнопка «не работала». Трекинг и снуз — уже после.
      tg?.addToHomeScreen?.();
      snoozeHomeScreen();
      api.trackEvent('home_screen_offer', { action: 'add', surface });
    }, [tg, surface]),
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
