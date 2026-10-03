// Логика дыхания 4-4-6 — одна на обе вёрстки BreathingCard (мини-апп и сайт,
// правило «одна механика — один компонент»): таймер, фазы, засчитывание
// прохождения, окно шаринга. Вёрстка — BreathingAppView / BreathingSiteView.
// Прохождение засчитывается через useQuickPractice, только если пройден хотя
// бы один полный цикл (BREATH_CYCLE_S) — досрочная остановка не считается.
import { useEffect, useRef, useState } from 'react';
import {
  breathStateAt,
  BREATH_IN_S,
  BREATH_HOLD_S,
  BREATH_OUT_S,
  BREATH_CYCLE_S,
} from './breathing';
import { isReducedMotion } from '../utils/reducedMotion';
import { useTr } from '../utils/addressForm';
import { useQuickPractice, type QuickPracticeApi } from './useQuickPractice';
import { practiceCountLabel } from './PracticeDoneFooter';
import { buildQuickPractice } from './quickPractices';

const PHASE_SCALE = { in: 1.25, hold: 1.25, out: 1 } as const;

/** Пульс круга в покое; глушится глобальным reduced-motion блоком index.css. */
export const BREATHE_IDLE_KEYFRAMES = `@keyframes breathe-idle { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }`;

export function useBreathingSession(
  api: QuickPracticeApi & {
    trackEvent: (name: string, meta?: Record<string, unknown>) => void;
  },
) {
  const tr = useTr();
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { count, complete } = useQuickPractice('breathing', api);
  const practice = buildQuickPractice('breathing', tr);

  useEffect(() => {
    if (!active) return;
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active]);

  function start() {
    setElapsed(0);
    setActive(true);
    api.trackEvent('breath_start');
  }

  function stop() {
    setActive(false);
    // Засчитываем только полный круг — досрочный обрыв не практика.
    if (elapsed >= BREATH_CYCLE_S) complete();
    setElapsed(0);
  }

  const st = breathStateAt(elapsed);
  const scale = active && !isReducedMotion() ? PHASE_SCALE[st.phase] : 1;
  const phaseDur =
    st.phase === 'in'
      ? BREATH_IN_S
      : st.phase === 'hold'
        ? BREATH_HOLD_S
        : BREATH_OUT_S;

  return {
    tr,
    active,
    st,
    scale,
    phaseDur,
    start,
    stop,
    count,
    practice,
    countLabel: practiceCountLabel(count),
    showShare,
    setShowShare,
  };
}

export type BreathingSession = ReturnType<typeof useBreathingSession>;
