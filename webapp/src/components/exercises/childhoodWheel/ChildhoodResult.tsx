import { ExScreen } from '../ExScreen';
import { TherapyNote } from '../../TherapyNote';
import { useTr } from '../../../utils/addressForm';
import { hueStyle, NEED_HUE } from '../../../lib/tone';
import { pluralRu } from '../../../../../shared/src/utils/pluralRu';
import {
  childhoodAverage,
  lowNeedIds,
} from '../../../../../shared/src/childhoodWheel/childhoodWheel';
import { NEEDS } from './needs';
import { WheelSvg } from './WheelSvg';
import { SchemaHints } from './SchemaHints';
import '../../../styles/sheet-childhood.css';

/** Результат колеса: оценки, колесо, схемы по низким зонам, «Изменить». */
export function ChildhoodResult({
  title,
  ratings,
  onBack,
  onEdit,
  onOpenSchema,
  onOpenSchemas,
}: {
  title: React.ReactNode;
  ratings: Record<string, number>;
  onBack: () => void;
  onEdit: () => void;
  onOpenSchema: (schemaId: string) => void;
  onOpenSchemas?: () => void;
}) {
  const tr = useTr();
  const avg = childhoodAverage(ratings);
  const lowIds = lowNeedIds(ratings);

  return (
    <ExScreen
      onBack={onBack}
      eyebrow="Колесо детства · сохранено"
      title={title}
      lede={`Среднее ${avg}/10.${lowIds.length ? ` ${lowIds.length} ${pluralRu(lowIds.length, 'зона', 'зоны', 'зон')} ниже 5 – это места, где могли сформироваться схемы.` : ''}`}
      aside={
        <div className="ds-card ex2-note">
          <div className="ds-label">Что дальше</div>
          <h3 className="ex2-note-h">Связать с сегодня</h3>
          <p className="ex2-note-body">
            {tr(
              'Открой дневник за последнюю неделю и сравни – какие потребности сегодня просели больше всего. Часто это те же зоны.',
              'Откройте дневник за последнюю неделю и сравните – какие потребности сегодня просели больше всего. Часто это те же зоны.',
            )}
          </p>
        </div>
      }
    >
      <div className="ex2-cw-grid">
        <div>
          {NEEDS.map((n, i) => (
            <div key={n.id} className="ex2-cw-row" style={hueStyle(NEED_HUE[n.id])}>
              <span className="ex2-cw-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="ex2-cw-label">{n.label}</div>
                <div className="ex2-cw-q">
                  {ratings[n.id] <= 4
                    ? n.low
                    : ratings[n.id] >= 8
                      ? n.high
                      : 'Где-то между. Бывало по-разному.'}
                </div>
              </div>
              <div className="ex2-cw-value">
                {ratings[n.id]}
                <span>/10</span>
              </div>
            </div>
          ))}
        </div>
        <div className="ds-card ex2-note">
          <h3 className="ex2-note-h">{tr('Твоё колесо', 'Ваше колесо')}</h3>
          <WheelSvg ratings={ratings} />
        </div>
      </div>

      {lowIds.length > 0 ? (
        <SchemaHints
          lowIds={lowIds}
          ratings={ratings}
          onOpenSchema={onOpenSchema}
          onOpenSchemas={onOpenSchemas}
        />
      ) : (
        <div className="ds-card cw-good">
          <div className="cw-good-title">Хорошее детство по всем зонам</div>
          <p className="cw-good-body">
            Все потребности выше 4/10 – это редкость и ресурс. Если сейчас что-то низкое, скорее
            всего это ситуативное, а не схема.
          </p>
        </div>
      )}

      <div className="cw-note">
        <TherapyNote compact />
      </div>

      <div className="ex2-foot">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={onEdit}>
          ✎ Изменить
        </button>
        <span className="ex2-spacer" />
        <button type="button" className="ds-btn" onClick={onBack}>
          Готово
        </button>
      </div>
    </ExScreen>
  );
}
