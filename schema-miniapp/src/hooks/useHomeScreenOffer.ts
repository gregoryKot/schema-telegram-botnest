import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import {
  getOfferMemory,
  homeScreenAddSupported,
  homeScreenPlatform,
  homeScreenStatusSupported,
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

  // Методы добавления на экран (Bot API 8.0) присутствуют как заглушки и в
  // старых клиентах, где они НЕ работают. Реальную поддержку определяем по
  // версии (homeScreen*Supported) — иначе показываем нерабочую кнопку.
  const supported = homeScreenAddSupported();
  const statusApiAvailable = homeScreenStatusSupported();

  // Статус значка спрашиваем у Telegram, а не у человека: он мог добавить
  // приложение с другого устройства или снести значок с экрана.
  useEffect(() => {
    if (statusApiAvailable) {
      tg?.checkHomeScreenStatus?.((s) => {
        if (s === 'added') markHomeScreenAdded();
        setStatus(s);
      });
    }
    const onAdded = () => {
      markHomeScreenAdded();
      setStatus('added');
      api.trackEvent('home_screen_offer', { action: 'added', surface });
    };
    tg?.onEvent?.('homeScreenAdded', onAdded);
    return () => tg?.offEvent?.('homeScreenAdded', onAdded);
  }, [tg, surface, statusApiAvailable]);

  const visible =
    !dismissed &&
    shouldOfferHomeScreen({
      platform: tg?.platform,
      hasApi: supported,
      statusApiAvailable,
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
      api.trackEvent('home_screen_offer', { action: 'add', surface });
      // Если человек передумает в нативном шите — не спрашиваем снова сразу,
      // вернёмся через неделю. Карточку убираем сразу (иначе висит до
      // следующего ре-рендера — snooze в localStorage сам его не вызывает).
      snoozeHomeScreen();
      setDismissed(true);
      tg?.addToHomeScreen?.();
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
