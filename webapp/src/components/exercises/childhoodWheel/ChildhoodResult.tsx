import { ExScreen } from '../ExScreen';
import { TherapyNote } from '../../TherapyNote';
import { pluralRu } from '../../../../../shared/src/utils/pluralRu';
import {
  childhoodAverage,
  lowNeedIds,
} from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import { WheelScene } from './WheelScene';
import { ResultRows, NextToday } from './ResultParts';
import { SchemaHints } from './SchemaHints';
import '../../../styles/sheet-childhood.css';

/**
 * Результат колеса. Герой — лист персика со сценой по оценкам (SceneChildhood values): короткие бледные
 * полоски сразу показывают, чего не хватило; на компьютере — липкой колонкой разворота. Справа (на
 * телефоне — ниже) пять оценок, схемы по низким зонам, «Связать с сегодня» и «Изменить» / «Готово».
 */
export function ChildhoodResult({
  title,
  ratings,
  onBack,
  onEdit,
  onOpenSchema,
  onOpenSchemas,
  onOpenToday,
}: {
  title: React.ReactNode;
  ratings: Record<string, number>;
  onBack: () => void;
  onEdit: () => void;
  onOpenSchema: (schemaId: string) => void; onOpenSchemas?: () => void;
  /** Перейти в «Историю» трекера («Связать с сегодня»); без него плитка — без перехода. */
  onOpenToday?: () => void;
}) {
  const avg = childhoodAverage(ratings);
  const lowIds = lowNeedIds(ratings);

  return (
    <ExScreen
      onBack={onBack} spread look="childhood_wheel" heroArt={<WheelScene ratings={ratings} className="chw-scene--hero" />}
      eyebrow="Колесо детства · сохранено"
      title={title}
      lede={`Среднее ${avg}/10.${lowIds.length ? ` ${lowIds.length} ${pluralRu(lowIds.length, 'зона', 'зоны', 'зон')} ниже 5 – это места, где могли сформироваться схемы.` : ''}`}
    >
      <ResultRows ratings={ratings} />

      {lowIds.length > 0 ? (
        <SchemaHints
          lowIds={lowIds}
          ratings={ratings}
          onOpenSchema={onOpenSchema}
          onOpenSchemas={onOpenSchemas}
        />
      ) : (
        <div className="pp-paper chw-good">
          <div className="chw-good-title">Хорошее детство по всем зонам</div>
          <p className="chw-good-body">
            Все потребности выше 4/10 – это редкость и ресурс. Если сейчас что-то низкое, скорее
            всего это ситуативное, а не схема.
          </p>
        </div>
      )}

      <NextToday onOpen={onOpenToday} />

      <div className="chw-note">
        <TherapyNote compact />
      </div>

      <div className="ex2-foot">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={onEdit}>
          Изменить
        </button>
        <span className="ex2-spacer" />
        <button type="button" className="ds-btn" onClick={onBack}>
          Готово
        </button>
      </div>
    </ExScreen>
  );
}
