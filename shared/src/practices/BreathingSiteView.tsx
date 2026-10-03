// Вёрстка дыхания 4-4-6 для сайта (variant="site"): editorial — без плашки,
// между двумя тонкими линиями; эйбрау, serif-заголовок, подпись слева, круг —
// тонкий контур справа, главная кнопка — чёрная пилюля сайта (.btn-primary).
// Без blur/backdrop-filter и цветов мини-аппа. Логика — useBreathingSession.
import { BREATH_PHASE_LABEL } from './breathing';
import {
  BREATHE_IDLE_KEYFRAMES,
  type BreathingSession,
} from './useBreathingSession';

const SERIF_28 = {
  fontFamily: 'var(--serif)',
  fontWeight: 400,
  fontSize: 28,
  lineHeight: 1.15,
  color: 'var(--text)',
} as const;

export function BreathingSiteView({ s }: { s: BreathingSession }) {
  const { tr, active, st, scale, phaseDur } = s;
  return (
    <div
      style={{
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        padding: '28px 0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-24)',
      }}
    >
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div className="eyebrow">Дыхание 4-4-6</div>
        <div style={{ ...SERIF_28, marginTop: 'var(--space-8)' }}>
          {active
            ? BREATH_PHASE_LABEL[st.phase]
            : tr('Дыши со мной', 'Дышите со мной')}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            marginTop: 'var(--space-8)',
            lineHeight: 1.6,
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
          className={active ? undefined : 'btn btn-primary'}
          onClick={active ? s.stop : s.start}
          style={{
            marginTop: 'var(--space-16)',
            minHeight: 44,
            padding: '0 24px',
            borderRadius: 999,
            fontSize: 14,
            fontFamily: 'inherit',
            cursor: 'pointer',
            ...(active && {
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--line-strong)',
            }),
          }}
        >
          {active ? 'Достаточно' : 'Начать дыхание'}
        </button>
      </div>
      <div
        style={{
          width: 88,
          height: 88,
          flexShrink: 0,
          borderRadius: '50%',
          border: '1.5px solid var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--serif)',
          fontSize: 32,
          color: 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
          animation: active ? 'none' : 'breathe-idle 5s ease-in-out infinite',
          transform: `scale(${scale})`,
          transition: `transform ${phaseDur}s ease-in-out`,
        }}
      >
        <style>{BREATHE_IDLE_KEYFRAMES}</style>
        {active ? st.secondsLeft : null}
      </div>
    </div>
  );
}
