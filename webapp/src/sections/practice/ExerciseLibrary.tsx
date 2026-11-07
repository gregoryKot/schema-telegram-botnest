import '../../styles/client-practice.css';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { pressable } from '../../utils/a11y';
import { Wheel } from '../../components/art/PaperArtSigns';
import { fmtAgo } from '../../utils/format';
import { EXERCISES, fmtCount, type ExId, type ExStats } from './exerciseLibraryModel';

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
        {items.map(ex => {
          const s = stats[ex.id];
          return (
            <div key={ex.id} className={'ds-card ds-card--hover cp-ex' + (phone ? ' ds-card--row' : '')} {...pressable(() => onOpen(ex.id))}>
              <div className="cp-ex-top"><span className="ds-num cp-ex-num">{ex.num}</span><span className="cp-ex-time">{ex.time}</span></div>
              {ex.id === 'wheel' && <Wheel size="row" />}
              <div className="ds-label cp-ex-eyebrow">{ex.eyebrow}</div>
              <div className="cp-ex-title">{ex.title}</div>
              <div className="cp-ex-desc">{ex.desc}</div>
              <div className={'cp-ex-state' + (s ? '' : ' is-new')}>{s ? `${fmtCount(s.count)} · ${s.lastDone ? fmtAgo(s.lastDone) : 'пройдено'}` : 'не начато'}</div>
              {phone && <span className="ds-chev" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
