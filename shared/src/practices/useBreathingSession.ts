// Сессия дыхания 4-4-6: таймер, конец по обещанию и засчитывание — одна на
// обе вёрстки (рамка createBreathingCard). Карточка обещает «одна минута»:
// через BREATH_SESSION_S дыхание само заканчивается итогом и засчитывается;
// «Ещё минуту» — по желанию. До QA 2026-11 (М10) круги шли бесконечно, а
// засчитывала только кнопка «Достаточно» — уход со страницы после полного
// круга терял прохождение. Досрочный обрыв до полного круга (BREATH_CYCLE_S)
// по-прежнему не практика.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BREATH_CYCLE_S, BREATH_SESSION_S } from './breathing';
import { useQuickPractice, type QuickPracticeApi } from './useQuickPractice';

export type BreathingApi = QuickPracticeApi & {
  trackEvent: (name: string, meta?: Record<string, unknown>) => void;
};

export function useBreathingSession(api: BreathingApi) {
  const [active, setActive] = useState(false);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Секунды текущего подхода — для таймера и ухода со страницы.
  const elapsedRef = useRef(0);
  const { count, complete } = useQuickPractice('breathing', api);
  const completeRef = useRef(complete);
  useLayoutEffect(() => {
    completeRef.current = complete;
  });

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current < BREATH_SESSION_S) return;
      setActive(false); // минута позади: итог, засчитано
      setFinished(true);
      completeRef.current();
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);

  // Ушли со страницы посреди дыхания: полный круг засчитывается, как
  // «Достаточно» (второй записи не будет — useQuickPractice шлёт одну).
  useEffect(
    () => () => {
      if (elapsedRef.current >= BREATH_CYCLE_S) completeRef.current();
    },
    [],
  );

  function start() {
    elapsedRef.current = 0;
    setElapsed(0);
    setFinished(false);
    setActive(true);
    api.trackEvent('breath_start');
  }

  function stop() {
    setActive(false);
    // Засчитываем только полный круг — досрочный обрыв не практика.
    if (elapsedRef.current >= BREATH_CYCLE_S) complete();
    elapsedRef.current = 0;
    setElapsed(0);
  }

  return { active, finished, elapsed, count, start, stop };
}
