// Вёрстка «Дыши со мной» на сайте: герой-блок бумажной аппликации (pp-block + pp-hero).
// В покое справа картинка Breath, во время дыхания и после него — тот же слот занимает
// круг с обратным отсчётом. Логика — useBreathingSession (shared/practices).
import { Breath } from '../art/PaperArt';
import { PracticeDoneFooterSite } from '../../../../shared/src/practices/PracticeDoneFooterSite';
import {
  createBreathingCard,
  BREATHE_IDLE_KEYFRAMES,
  type BreathingViewProps,
} from '../../../../shared/src/practices/createBreathingCard';

export function BreathingPaperView({ active, finished, text, st, pulse, start, stop }: BreathingViewProps) {
  return (
    <div className="pp-block">
      <div className="pp-hero">
        <div className="pp-hero-body">
          <div className="ds-label">Дыхание 4-4-6</div>
          <div className="pp-hero-title">{text.title}</div>
          <div className="pp-hero-text">
            {text.lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </div>
        </div>
        {active || finished ? (
          <div className="cp-ring" style={pulse}>
            {active ? st.secondsLeft : '✓'}
          </div>
        ) : (
          <Breath size="hero" />
        )}
      </div>
      <button
        className={active || finished ? 'ds-btn ds-btn--secondary' : 'ds-btn'}
        onClick={active ? stop : start}
      >
        {text.action}
      </button>
      <style>{BREATHE_IDLE_KEYFRAMES}</style>
    </div>
  );
}

/** Карточка «Дыши со мной» сайта: логика общая, вёрстка — герой-блок выше. */
export const BreathingSiteCard = createBreathingCard(BreathingPaperView, PracticeDoneFooterSite);
