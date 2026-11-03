// Вёрстка дыхания 4-4-6 для сайта: карточка ds-card — ds-label, заголовок
// ds-h3, подпись ds-sub, круг справа, кнопки ds-btn (не .btn-primary). Без
// blur/backdrop-filter и цветов мини-аппа. Логика — useBreathingSession.
import { BREATH_PHASE_LABEL } from './breathing';
import {
  BREATHE_IDLE_KEYFRAMES,
  type BreathingViewProps,
} from './createBreathingCard';

export function BreathingSiteView({
  tr,
  active,
  st,
  pulse,
  start,
  stop,
}: BreathingViewProps) {
  return (
    <div
      className="ds-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-16)',
      }}
    >
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div className="ds-label">Дыхание 4-4-6</div>
        <div className="ds-h3" style={{ marginTop: 'var(--space-8)' }}>
          {active
            ? BREATH_PHASE_LABEL[st.phase]
            : tr('Дыши со мной', 'Дышите со мной')}
        </div>
        <div className="ds-sub" style={{ marginTop: 'var(--space-8)' }}>
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
          className={active ? 'ds-btn ds-btn--secondary' : 'ds-btn'}
          onClick={active ? stop : start}
          style={{ marginTop: 'var(--space-16)' }}
        >
          {active ? 'Достаточно' : 'Начать дыхание'}
        </button>
      </div>
      <div
        style={{
          width: 'clamp(64px, 18vw, 88px)',
          height: 'clamp(64px, 18vw, 88px)',
          flexShrink: 0,
          borderRadius: '50%',
          border: '1.5px solid var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--serif)',
          fontSize: 'clamp(24px, 6vw, 32px)',
          color: 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
          ...pulse,
        }}
      >
        <style>{BREATHE_IDLE_KEYFRAMES}</style>
        {active ? st.secondsLeft : null}
      </div>
    </div>
  );
}
