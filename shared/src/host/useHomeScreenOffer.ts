import { useCallback, useEffect, useState } from 'react';
import { getHost } from './index';
import {
  getOfferMemory,
  homeScreenPlatform,
  markHomeScreenNever,
  shouldOfferHomeScreen,
  snoozeHomeScreen,
} from './homeScreen';

type Track = (name: string, meta: Record<string, string>) => void;

// Предложение «установить приложение» — одно на все места показа (карточка
// на «Сегодня», настройки): общая память об отказе и снузе. Логика «показывать ли» — чистая, в ./homeScreen. Обёртки сайта и
// мини-аппа подставляют свой api.trackEvent (правило №3: один хук на оба фронта).
export function useHomeScreenOfferState<S extends string>(
  surface: S,
  track: Track,
) {
  const host = getHost();
  const [dismissed, setDismissed] = useState(false);
  const [now] = useState(() => Date.now());

  const visible =
    !dismissed &&
    shouldOfferHomeScreen({
      hostId: host.id,
      platform: host.platform,
      memory: getOfferMemory(),
      now,
    });

  useEffect(() => {
    if (visible) track('home_screen_offer', { action: 'shown', surface });
  }, [visible, surface, track]);

  // Каждый исход: событие, память (снуз/отказ), скрыть карточку.
  const outcome = useCallback(
    (action: 'add' | 'later' | 'never', remember: () => void) => () => {
      track('home_screen_offer', { action, surface });
      remember();
      setDismissed(true);
    },
    [surface, track],
  );

  return {
    visible,
    platform: homeScreenPlatform(host.platform),
    /** Побочные действия после активации кнопки (сам переход — в кнопке). */
    noteAddTriggered: outcome('add', snoozeHomeScreen),
    later: outcome('later', snoozeHomeScreen),
    never: outcome('never', markHomeScreenNever),
  };
}
