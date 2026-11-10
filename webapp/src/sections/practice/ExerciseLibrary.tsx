import '../../styles/client-practice.css';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { EXERCISES, type ExId, type ExStats } from './exerciseLibraryModel';
import { ExerciseTile } from './ExerciseTile';

type Card = (typeof EXERCISES)[number];

/** Библиотека упражнений — бенто плиток бумаги (ExerciseTile); на телефоне зовётся «Инструменты». */
export function ExerciseLibrary({ stats, onOpen, phone = false, items = EXERCISES }: {
  stats: Partial<Record<ExId, ExStats>>; onOpen: (id: ExId) => void; phone?: boolean;
  items?: Card[]; // в порядке пользователя и без скрытых (toolsLayout.arrangeExercises)
}) {
  if (items.length === 0) return null; // всё скрыто — раздел без заголовка не рисуем
  return (
    <section className="cp-block cp-lib-block">
      <div className="ds-head-row">
        <h3 className="ds-h2">{phone ? 'Инструменты' : 'Библиотека'}</h3>
        <span className="ds-sub">{items.length} {pluralRu(items.length, 'упражнение', 'упражнения', 'упражнений')}</span>
      </div>
      <div className="cp-lib">
        {items.map(ex => <ExerciseTile key={ex.id} ex={ex} stat={stats[ex.id]} phone={phone} onOpen={() => onOpen(ex.id)} />)}
      </div>
    </section>
  );
}
