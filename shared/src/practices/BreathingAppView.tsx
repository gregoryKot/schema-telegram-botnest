// Вёрстка дыхания 4-4-6 для мини-аппа: тонированная карточка
// с кругом и зелёной пилюлей. Логика — useBreathingSession.
import {
  BREATHE_IDLE_KEYFRAMES,
  type BreathingViewProps,
} from './createBreathingCard';

export function BreathingAppView({
  active,
  finished,
  text,
  st,
  pulse,
  start,
  stop,
}: BreathingViewProps) {
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
          ...pulse,
        }}
      >
        <style>{BREATHE_IDLE_KEYFRAMES}</style>
        {active ? st.secondsLeft : finished ? '✓' : null}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: 'var(--accent-green)',
          marginTop: 'var(--space-20)',
        }}
      >
        {text.title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {text.lines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </div>
      <button
        onClick={active ? stop : start}
        style={{
          marginTop: 16,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          background:
            active || finished
              ? 'rgba(var(--fg-rgb),0.08)'
              : 'var(--accent-green)',
          color: active || finished ? 'var(--text-sub)' : 'var(--bg)',
          fontSize: 14,
          fontWeight: 800,
          padding: '12px 28px',
          borderRadius: 999,
          minHeight: 44,
        }}
      >
        {text.action}
      </button>
    </div>
  );
}
