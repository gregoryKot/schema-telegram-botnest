import { pressable } from '../../utils/a11y';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import { NEED_LABELS, avgBarPct, type SchemaInfo } from '../../hooks/useYsqTest';

interface Props {
  schema: SchemaInfo;
  avg: number;
  n5plus: number;
  nQuestions: number;
  tip: string;
  delta: number | null;
  diaryRating?: number;
  onOpen: () => void;
}

/** Карточка выраженной схемы в результате: балл, бар цветом домена, совет, ссылка на описание. */
export function YsqSchemaCard({ schema, avg, n5plus, nQuestions, tip, delta, diaryRating, onOpen }: Props) {
  const showDiaryHint = diaryRating !== undefined && diaryRating <= 4;
  return (
    <div className="ds-card ss-res-card" style={hueStyle(NEED_HUE[schema.needId as NeedId])}>
      <div className="ss-res-top">
        <div className="ss-res-name">
          <span className="ds-dot tone-fill" />
          {schema.name}
        </div>
        <div className="ss-res-val">
          {delta !== null && Math.abs(delta) >= 0.3 && (
            <span className={`ss-delta ${delta < 0 ? 'is-down' : 'is-up'}`}>{delta > 0 ? '+' : ''}{delta}</span>
          )}
          <span className="tone-ink">{avg}</span><small>/ 6</small>
        </div>
      </div>

      {/* Главная метрика — средний балл (1–6); классика (ответы «5–6») —
          понятной строкой «N из M», а не голым «0%». */}
      <div className="ss-bar-track" role="img" aria-label={`Средний балл ${avg} из 6`}>
        <span className="ss-bar-fill tone-fill" style={{ width: `${avgBarPct(avg)}%` }} />
      </div>
      <div className="ss-res-meta">Средний балл: {avg} из 6 · Ответов «5» или «6»: {n5plus} из {nQuestions}</div>

      <div className="ss-res-desc">{schema.desc}</div>
      <div className="ss-res-tip">{tip}</div>

      <div {...pressable(onOpen)} className="ss-res-link">
        <span className="ds-link">Читать карточку схемы</span>
        <span className="ds-link">›</span>
      </div>

      {showDiaryHint && (
        <div className="ss-res-hint">Совпадает с дневником: «{NEED_LABELS[schema.needId]}» стабильно низкая</div>
      )}
    </div>
  );
}
