import { useCallback, useEffect, useState } from 'react';
import { getHost } from './index';
import {
  getOfferMemory,
  homeScreenPlatform,
  markHomeScreenAdded,
  markHomeScreenNever,
  shouldOfferHomeScreen,
  snoozeHomeScreen,
  type TgHomeScreenStatus,
} from './homeScreen';

type Track = (name: string, meta: Record<string, string>) => void;

// Предложение «добавить значок на экран» — одно на все места показа (шаг
// онбординга, карточка на «Сегодня», настройки): общая память об отказе и
// снузе. Логика «показывать ли» — чистая, в ./homeScreen. Обёртки сайта и
// мини-аппа подставляют свой api.trackEvent (правило №3: один хук на оба фронта).
export function useHomeScreenOfferState<S extends string>(
  surface: S,
  track: Track,
) {
  const host = getHost();
  const [status, setStatus] = useState<TgHomeScreenStatus | undefined>();
  const [dismissed, setDismissed] = useState(false);
  const [now] = useState(() => Date.now());

  // Статус значка спрашиваем у хоста, а не у человека: он мог добавить
  // приложение с другого устройства или снести значок с экрана.
  useEffect(() => {
    host.homeScreen.checkStatus(setStatus);
    return host.homeScreen.onAdded(() => {
      markHomeScreenAdded();
      setStatus('added');
      track('home_screen_offer', { action: 'added', surface });
    });
  }, [host, surface, track]);

  // До ответа Telegram о статусе значка карточку не показываем: иначе она
  // мигает (и шлёт shown) у тех, у кого значок уже стоит.
  const visible =
    !dismissed &&
    status !== undefined &&
    shouldOfferHomeScreen({
      platform: host.platform,
      hasApi: host.capabilities.homeScreen,
      tgStatus: status,
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
    /** Побочные действия после активации кнопки (сам триггер — в кнопке). */
    noteAddTriggered: outcome('add', snoozeHomeScreen),
    later: outcome('later', snoozeHomeScreen),
    never: outcome('never', markHomeScreenNever),
  };
}
