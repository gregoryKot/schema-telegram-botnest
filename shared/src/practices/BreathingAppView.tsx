// Вёрстка дыхания 4-4-6 для мини-аппа (variant="app"): тонированная карточка
// с кругом и зелёной пилюлей. Логика — useBreathingSession.
import { BREATH_PHASE_LABEL } from './breathing';
import {
  BREATHE_IDLE_KEYFRAMES,
  type BreathingSession,
} from './useBreathingSession';

export function BreathingAppView({ s }: { s: BreathingSession }) {
  const { tr, active, st, scale, phaseDur } = s;
  return (
    <div
      style={{
        borderRadius: 'var(--r-20)',
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
        <style>{BREATHE_IDLE_KEYFRAMES}</style>
        {active ? st.secondsLeft : null}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: 'var(--accent-green)',
          marginTop: 'var(--space-20)',
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
        onClick={active ? s.stop : s.start}
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
          borderRadius: 999,
          minHeight: 44,
        }}
      >
        {active ? 'Достаточно' : 'Начать дыхание'}
      </button>
    </div>
  );
}
