import type { CSSProperties } from 'react';
import { SignArt } from '../components/art/SignArt';
import type { TodayCounts } from './therapistTodayModel';
import { TODAY_COUNTER_LOOK } from '../components/therapist/cabinetLook';

/** Три счётчика «Сегодня» на бумаге экрана, без цветных плиток: знак (Strokes, Talk, Heart), крупное число
 *  и подпись под линией. Не кнопки: реакции на наведение нет. Цвет числа — только у «внимания» больше нуля. */
export function TherapistTodayCounters({ counts }: { counts: TodayCounts }) {
  const { active, sessions, attention } = TODAY_COUNTER_LOOK;
  const tile = (look: { hue: number }) => ({ '--h': look.hue } as CSSProperties);
  return (
    <div className="tt-counters">
      <div className="tt-counter" style={tile(active)}>
        <span className="tt-counter-sign" aria-hidden="true"><SignArt sign={active.sign} size="row" /></span>
        <div className="ds-label">Активны сегодня</div>
        <div className="ds-num">{counts.active}<span className="tt-denom"> / {counts.total}</span></div>
      </div>
      <div className="tt-counter" style={tile(sessions)}>
        <span className="tt-counter-sign" aria-hidden="true"><SignArt sign={sessions.sign} size="row" /></span>
        <div className="ds-label">Сессий сегодня</div>
        <div className="ds-num">{counts.sessions}</div>
      </div>
      <div className={`tt-counter${counts.attention > 0 ? ' tt-counter--warn' : ''}`} style={tile(attention)}>
        <span className="tt-counter-sign" aria-hidden="true"><SignArt sign={attention.sign} size="row" /></span>
        <div className="ds-label">Требуют внимания</div>
        <div className="ds-num">{counts.attention}</div>
      </div>
    </div>
  );
}
