// «Дыши со мной» — дыхание 4-4-6 (экран «Здесь и сейчас», дизайн-макет;
// волна 2 нейродизайна). Idle-состояние — спокойная карточка с пульсирующим
// кругом (CSS-анимация breathe глушится глобальным reduced-motion блоком
// index.css); активная сессия — фазы из utils/breathing с крупным отсчётом.
// При сниженной анимации круг не масштабируется — только текст фаз.
import { useEffect, useRef, useState } from 'react';
import {
  breathStateAt,
  BREATH_PHASE_LABEL,
  BREATH_IN_S,
  BREATH_HOLD_S,
  BREATH_OUT_S,
} from '../utils/breathing';
import { isReducedMotion } from '../utils/reducedMotion';
import { useTr } from '../utils/addressForm';
import { api } from '../api';

const PHASE_SCALE = { in: 1.25, hold: 1.25, out: 1 } as const;

export function BreathingCard() {
  const tr = useTr();
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setElapsed(0);
  }

  const st = breathStateAt(elapsed);
  const reduced = isReducedMotion();
  const scale = active && !reduced ? PHASE_SCALE[st.phase] : 1;
  const phaseDur =
    st.phase === 'in'
      ? BREATH_IN_S
      : st.phase === 'hold'
        ? BREATH_HOLD_S
        : BREATH_OUT_S;

  return (
    <div
      style={{
        borderRadius: 24,
        background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
        padding: '26px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: '50%',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: active ? 26 : 40,
          fontWeight: 800,
          color: 'var(--accent-green)',
          fontVariantNumeric: 'tabular-nums',
          animation: active ? 'none' : 'breathe-idle 5s ease-in-out infinite',
          transform: `scale(${scale})`,
          transition: `transform ${phaseDur}s ease-in-out`,
        }}
      >
        <style>{`@keyframes breathe-idle { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }`}</style>
        {active ? st.secondsLeft : '🫧'}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: 'var(--accent-green)',
          marginTop: 18,
        }}
      >
        {active
          ? BREATH_PHASE_LABEL[st.phase]
          : tr('Дыши со мной', 'Дышите со мной')}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {active ? (
          <>круг {st.cycle} · вдох 4 · задержка 4 · выдох 6</>
        ) : (
          <>
            Вдох на 4 · задержка на 4 · выдох на 6.
            <br />
            Одна минута — и станет легче.
          </>
        )}
      </div>
      <button
        onClick={active ? stop : start}
        style={{
          marginTop: 16,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          background: active
            ? 'rgba(var(--fg-rgb),0.08)'
            : 'var(--accent-green)',
          color: active ? 'var(--text-sub)' : 'var(--bg)',
          fontSize: 14,
          fontWeight: 800,
          padding: '12px 28px',
          borderRadius: 99,
          minHeight: 44,
        }}
      >
        {active ? 'Достаточно' : 'Начать дыхание'}
      </button>
    </div>
  );
}
