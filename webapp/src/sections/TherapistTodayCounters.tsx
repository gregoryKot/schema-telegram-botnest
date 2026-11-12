import type { CSSProperties } from 'react';
import { SignArt } from '../components/art/SignArt';
import type { TodayCounts } from './therapistTodayModel';
import { TODAY_COUNTER_LOOK } from '../components/therapist/cabinetLook';

/** Три счётчика «Сегодня» — плитки бумаги со знаком (ENTITY_LOOK словами, «Кабинет терапевта»):
 *  «Активны сегодня» — Strokes на шалфее, «Сессий сегодня» — Talk на небе, «Требуют внимания» —
 *  Heart на персике. Не кнопки: реакции на наведение нет. Цвет числа — только у «внимания» больше нуля. */
export function TherapistTodayCounters({ counts }: { counts: TodayCounts }) {
  const { active, sessions, attention } = TODAY_COUNTER_LOOK;
  const tile = (look: { hue: number }) => ({ '--h': look.hue } as CSSProperties);
  return (
    <div className="tt-counters">
      <div className="pp-paper tt-counter" style={tile(active)}>
        <span className="tt-counter-sign" aria-hidden="true"><SignArt sign={active.sign} size="row" /></span>
        <div className="ds-label">Активны сегодня</div>
        <div className="ds-num">{counts.active}<span className="tt-denom"> / {counts.total}</span></div>
      </div>
      <div className="pp-paper tt-counter" style={tile(sessions)}>
        <span className="tt-counter-sign" aria-hidden="true"><SignArt sign={sessions.sign} size="row" /></span>
        <div className="ds-label">Сессий сегодня</div>
        <div className="ds-num">{counts.sessions}</div>
      </div>
      <div className={`pp-paper tt-counter${counts.attention > 0 ? ' tt-counter--warn' : ''}`} style={tile(attention)}>
        <span className="tt-counter-sign" aria-hidden="true"><SignArt sign={attention.sign} size="row" /></span>
        <div className="ds-label">Требуют внимания</div>
        <div className="ds-num">{counts.attention}</div>
      </div>
    </div>
  );
}
