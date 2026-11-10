// Тело пошагового листа «Здесь и сейчас» (заземление 5-4-3-2-1, «Стоп») на живой бумаге: лист
// оттенка практики (ENTITY_LOOK[id]) — название, «зачем» и знак практики (Grounded, Pause) сверху,
// ниже шаг-герой: число или буква шага крупно на белом квадратике, заголовок Literata, подпись и
// счётчик формой (камешки 5-4-3-2-1, буквы С-Т-О-П). Кнопки под листом, предупреждение площадки —
// под кнопками первого шага, тише самого шага. Итог — DoneSheet: знак практики с ростком,
// «Закрыть» главнее «Ещё круг». Логика шагов — useStepFlow (shared), запись — QuickPracticeFlow.
import type { CSSProperties } from 'react';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { useStepFlow } from '../../../../shared/src/practices/useStepFlow';
import { glue } from '../../../../shared/src/utils/typo';
import type { StepFlowProps } from '../../../../shared/src/practices/stepFlowTypes';
import { DoneSheet } from '../paper/DoneSheet';
import { SignHero } from '../paper/SignHero';
import { StepCounter } from './StepCounter';
import '../../styles/quick-practice.css';

export function QuickStepBody({ id, title, subtitle, steps, done, counter, repeatLabel, doneExtra, note, onClose }: StepFlowProps) {
  const [step, isDone, cur, nextLabel, onNext] = useStepFlow(steps, done, repeatLabel);
  const { hue, sign } = ENTITY_LOOK[id];
  if (isDone) {
    return (
      <DoneSheet
        entity={id}
        label="Итог"
        title={glue(cur.title)}
        sub={glue(cur.hint)}
        primary={{ label: 'Закрыть', onClick: onClose }}
        secondary={{ label: nextLabel, onClick: onNext }}
      >
        {doneExtra}
      </DoneSheet>
    );
  }
  return (
    <div className="qs" data-practice={id}>
      <div className="pp-paper qs-sheet" style={{ '--h': hue } as CSSProperties}>
        <div className="qs-head">
          <span className="qs-sign" aria-hidden="true"><SignHero sign={sign} /></span>
          <span className="ds-label qs-label">{glue(title)}</span>
          <p className="qs-sub">{glue(subtitle)}</p>
        </div>
        <div className="qs-step">
          {cur.mark && <span className="qs-mark" aria-hidden="true">{cur.mark}</span>}
          <div className="qs-step-body">
            <span className="ds-label qs-count">{`Шаг ${step + 1} из ${steps.length}`}</span>
            <h2 className="qs-title">{glue(cur.title)}</h2>
            <p className="qs-hint">{glue(cur.hint)}</p>
          </div>
        </div>
        <StepCounter kind={counter} steps={steps} step={step} />
      </div>
      <div className="qs-actions">
        <button type="button" className="ds-btn ds-btn--lg qs-next" onClick={onNext}>{nextLabel}</button>
        <button type="button" className="ds-link qs-close" onClick={onClose}>Закрыть</button>
      </div>
      {step === 0 && note}
    </div>
  );
}
