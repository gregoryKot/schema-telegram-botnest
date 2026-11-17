import { ExScreen } from '../ExScreen';
import { TherapyLine } from '../../therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../../therapy/useTherapyBridgeTexts';
import { pluralRu } from '../../../../../shared/src/utils/pluralRu';
import { fmtIndex } from '../../../../../shared/src/needs/dayIndex';
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
  const lowIds = lowNeedIds(ratings);
  const bridge = useTherapyBridgeTexts();

  return (
    <ExScreen
      onBack={onBack} spread look="childhood_wheel" heroArt={<WheelScene ratings={ratings} className="chw-scene--hero" />}
      eyebrow="Истоки · сохранено"
      title={title}
      lede={`Среднее ${fmtIndex(childhoodAverage(ratings))}/10.${lowIds.length ? ` ${lowIds.length} ${pluralRu(lowIds.length, 'зона', 'зоны', 'зон')} ниже 5 – это места, где могли сформироваться схемы.` : ''}`}
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
          <div className="chw-good-title">Явных провалов нет ни в одной зоне</div>
          <p className="chw-good-body">
            Все потребности выше 4/10, и это ресурс. Если сегодня что-то проседает, схему это не исключает: схемы
            складываются и в школьные годы, и от темперамента, а память о детстве часто мягче, чем было.
          </p>
        </div>
      )}

      <NextToday onOpen={onOpenToday} />

      <TherapyLine place="childhood_result" text={bridge.lineChildhood} className="chw-note" />

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
