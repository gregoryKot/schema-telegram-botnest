import { useSyncExternalStore } from 'react';
import { todayStr } from './format';

// «Сегодня» устройства, которое сменяется в полночь и у открытой вкладки (QA
// 2026-11-03, К3). TODAY_DATE из todayConstants.ts вычисляется один раз при
// загрузке бандла: PWA, которую не закрывают на ночь, после полуночи
// показывала вчерашний день как сегодняшний, а правка писала в новый день
// одну оценку из пяти — неполный день, который экран считал полным.
//
// Снимок — сама строка дня: React перерисует подписчиков, только когда она
// сменилась. Проверка — раз в полминуты (таймер фоновой вкладки браузер
// усыпляет, поэтому ещё и при возвращении на вкладку) и на каждое касание
// или клавишу: день сменится раньше, чем нажатие дойдёт до кнопки.
const CHECK_MS = 30_000;
const WINDOW_EVENTS = ['focus', 'pageshow', 'pointerdown', 'keydown'] as const;

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, CHECK_MS);
  const opts = { capture: true, passive: true };
  for (const e of WINDOW_EVENTS) window.addEventListener(e, onChange, opts);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    clearInterval(timer);
    for (const e of WINDOW_EVENTS)
      window.removeEventListener(e, onChange, opts);
    document.removeEventListener('visibilitychange', onChange);
  };
}

const snapshot = () => todayStr();

/** YYYY-MM-DD местного дня; компонент перерисуется, когда день сменится. */
export function useLocalDay(): string {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
