import '../../styles/client-practice.css';
import { hueStyle } from '../../lib/tone';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { pressable } from '../../utils/a11y';
import { fmtAgo } from '../../utils/format';
import { EXERCISES, exerciseHue, fmtCount, type ExId, type ExStats } from './exerciseLibrary';

type Card = (typeof EXERCISES)[number];

export function ExerciseLibrary({ stats, onOpen, phone = false, items = EXERCISES }: {
  stats: Partial<Record<ExId, ExStats>>; onOpen: (id: ExId) => void; phone?: boolean; // телефон: «Инструменты»
  items?: Card[]; // в порядке пользователя и без скрытых (toolsLayout.arrangeExercises)
}) {
  if (items.length === 0) return null; // всё скрыто — раздел без заголовка не рисуем
  return (
    <section className="cp-block">
      <div className="ds-head-row">
        <h3 className="ds-h2">{phone ? 'Инструменты' : 'Библиотека'}</h3>
        <span className="ds-sub">{items.length} {pluralRu(items.length, 'упражнение', 'упражнения', 'упражнений')}</span>
      </div>
      <div className="cp-lib">
        {items.map((ex, i) => {
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
                {s ? `${fmtCount(s.count)} · ${s.lastDone ? fmtAgo(s.lastDone) : 'пройдено'}` : 'не начато'}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
