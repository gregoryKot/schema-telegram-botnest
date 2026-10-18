import '../../styles/client-practice.css';
import { hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';
import { EXERCISES, exerciseHue, fmtAgo, fmtCount } from './exerciseLibrary';
import type { ExId, ExStats } from './exerciseLibrary';

export function ExerciseLibrary({ stats, onOpen, phone = false }: {
  stats: Partial<Record<ExId, ExStats>>; onOpen: (id: ExId) => void; phone?: boolean; // телефон: «Инструменты»
}) {
  return (
    <section className="cp-block">
      <div className="ds-head-row">
        <h3 className="ds-h2">{phone ? 'Инструменты' : 'Библиотека'}</h3>
        <span className="ds-sub">{EXERCISES.length} упражнений</span>
      </div>
      <div className="cp-lib">
        {EXERCISES.map((ex, i) => {
          const s = stats[ex.id];
          return (
            <div key={ex.id} className="cp-ex tone-tint" style={hueStyle(exerciseHue(i))} {...pressable(() => onOpen(ex.id))}>
              <div className="cp-ex-top">
                <span className="ds-num cp-ex-num">{ex.num}</span>
                <span className="cp-ex-time">{ex.time}</span>
              </div>
              <div className="cp-ex-eyebrow">{ex.eyebrow}</div>
              <div className="cp-ex-title">{ex.title}</div>
              <div className="cp-ex-desc">{ex.desc}</div>
              <div className={'cp-ex-state' + (s ? '' : ' is-new')}>
                {s ? `${fmtCount(s.count)} · ${fmtAgo(s.lastDone)}` : 'не начато'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
