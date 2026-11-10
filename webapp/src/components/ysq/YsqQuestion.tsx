import type { CSSProperties } from 'react';
import { ANSWER_LABELS, QUESTIONS, TOTAL_PAGES } from '../../hooks/useYsqTest';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';

interface Props {
  page: number;
  slideKey: number;
  slideDir: 'forward' | 'back';
  answer: number;
  onSelect: (value: number) => void;
  onBack: () => void;
  onClose: () => void;
}

/** Полноэкранная фаза теста: прогресс, вопрос на листе глины (ENTITY_LOOK.ysq), шкала 1–6, «Назад».
 *  Название шкалы и домен над утверждением не показываем: они подсказывают, что измеряет вопрос (B-М11). */
export function YsqQuestion({ page, slideKey, slideDir, answer, onSelect, onBack, onClose }: Props) {
  const pct = ((page + 1) / TOTAL_PAGES) * 100;
  return (
    <div className="ss-test" style={{ '--h': ENTITY_LOOK.ysq.hue } as CSSProperties}>
      <div className="ss-test-head">
        <div className="ss-test-row">
          <span className="ds-label ss-test-count">Вопрос {page + 1} из {TOTAL_PAGES}</span>
          <button onClick={onClose} aria-label="Закрыть" className="ds-btn ds-btn--icon">✕</button>
        </div>
        <div className="ss-progress" role="progressbar" aria-label="Вопрос теста" aria-valuemin={1} aria-valuemax={TOTAL_PAGES} aria-valuenow={page + 1}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="ss-test-body">
        <div key={slideKey} className={`ss-test-col ${slideDir === 'forward' ? 'ss-slide-r' : 'ss-slide-l'}`}>
          <div className="pp-paper ss-q"><p className="ss-q-text">{glue(QUESTIONS[page])}</p></div>
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
                  <span className="ss-scale-lbl">{glue(label)}</span>
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
