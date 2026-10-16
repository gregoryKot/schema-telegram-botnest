import { ANSWER_LABELS, QUESTIONS, TOTAL_PAGES } from '../../hooks/useYsqTest';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';

interface SchemaRef { name: string; needId: string }

interface Props {
  page: number;
  slideKey: number;
  slideDir: 'forward' | 'back';
  answer: number;
  schema: SchemaRef | null | undefined;
  onSelect: (value: number) => void;
  onBack: () => void;
  onClose: () => void;
}

/** Полноэкранная фаза теста: прогресс, карточка вопроса, шкала 1–6, «Назад». */
export function YsqQuestion({ page, slideKey, slideDir, answer, schema, onSelect, onBack, onClose }: Props) {
  const pct = ((page + 1) / TOTAL_PAGES) * 100;
  return (
    <div className="ss-test">
      <div className="ss-test-head">
        <div className="ss-test-row">
          <span className="ds-label ss-test-count">Вопрос {page + 1} из {TOTAL_PAGES}</span>
          <button onClick={onClose} aria-label="Закрыть" className="ds-btn ds-btn--icon">✕</button>
        </div>
        <div className="ss-progress" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_PAGES} aria-valuenow={page + 1}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="ss-test-body">
        <div key={slideKey} className={`ss-test-col ${slideDir === 'forward' ? 'ss-slide-r' : 'ss-slide-l'}`}>
          <div className="ds-card ss-q">
            {schema && (
              <div className="ds-eyebrow tone-text" style={hueStyle(NEED_HUE[schema.needId as NeedId])}>{schema.name}</div>
            )}
            <p className="ss-q-text">{QUESTIONS[page]}</p>
          </div>
          <div className="ss-scale" role="radiogroup" aria-label="Ответ от 1 до 6">
            {ANSWER_LABELS.map((label, i) => {
              const value = i + 1;
              const active = answer === value;
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(value)}
                  className={`ss-scale-btn${active ? ' is-active' : ''}`}
                >
                  <span className="ss-scale-num">{value}</span>
                  <span className="ss-scale-lbl">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ss-test-nav">
        <button onClick={onBack} disabled={page === 0} aria-label="Назад" className="ds-btn ds-btn--secondary">← Назад</button>
      </div>
    </div>
  );
}
