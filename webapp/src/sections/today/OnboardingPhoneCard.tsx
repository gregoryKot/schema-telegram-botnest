import { pressable } from '../../utils/a11y';
import { hitboxStyle } from '../../utils/hitbox';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import type { StepDef } from './onboardingSteps';

interface Props {
  steps: StepDef[];
  isDone: (step: StepDef) => boolean;
  skipped: string[];
  /** Текущий шаг; null — все невыполненные шаги отложены. */
  current: StepDef | null;
  doneCount: number;
  onSelect: (id: string | null) => void;
  onAction: (step: StepDef) => void;
  onSkip: (step: StepDef) => void;
  onResume: () => void;
}

// «С чего начать» на телефоне (≤767px): не весь чеклист, а счётчик и ОДНА
// карточка текущего шага — номер, название, подпись, описание, «Открыть»/«Позже»
// и точки прогресса (образец — schema-miniapp/src/sections/today/OnboardingWidget.tsx).
// Шаги и логика те же, что у десктопного чеклиста (onboardingSteps.ts).
export function OnboardingPhoneCard({
  steps, isDone, skipped, current, doneCount, onSelect, onAction, onSkip, onResume,
}: Props) {
  if (!current) {
    const postponed = steps.filter(s => !isDone(s)).length;
    return (
      <div className="ds-card sk-onb ob-p ob-p-resume">
        <div className="ob-p-resume-text">
          <div className="ob-p-resume-title">{postponed} {pluralRu(postponed, 'шаг отложен', 'шага отложено', 'шагов отложено')}</div>
          <div className="ds-sub">{doneCount} из {steps.length} выполнено</div>
        </div>
        <button type="button" className="ds-btn ds-btn--secondary ob-p-resume-btn" onClick={onResume}>Продолжить</button>
      </div>
    );
  }

  const done = isDone(current);
  const isSkipped = skipped.includes(current.id) && !done;
  const no = steps.findIndex(s => s.id === current.id) + 1;

  return (
    <div className="ds-card sk-onb ob-p">
      <div className="ob-p-count">{doneCount} из {steps.length} шагов выполнено</div>

      <div className="ob-p-step">
        <span
          className="ob-p-no"
          style={{
            background: `color-mix(in srgb, ${current.color} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${current.color} 24%, transparent)`,
          }}
        >
          {done ? '✓' : no}
        </span>
        <div className="ob-p-head">
          <div className="ob-p-title">{current.title}</div>
          <div className="ob-p-detail">{current.detail}</div>
        </div>
      </div>
      <p className="ob-p-desc">{current.description}</p>

      <div className="ob-p-actions">
        {done ? (
          <div className="ob-p-done">✓ Выполнено</div>
        ) : (
          <>
            <button type="button" className="ds-btn ob-p-main" onClick={() => onAction(current)}>
              {current.actionLabel}
            </button>
            <button type="button" className="ds-btn ds-btn--secondary ob-p-later" onClick={() => onSkip(current)}>
              {isSkipped ? 'Вернуть' : 'Позже'}
            </button>
          </>
        )}
      </div>

      <div className="ob-p-dots">
        {steps.map(s => {
          const d = isDone(s);
          const sk = skipped.includes(s.id) && !d;
          const cur = s.id === current.id;
          const hit = hitboxStyle(cur ? 20 : 8, 8, 24);
          const state = d ? ' is-done' : sk ? ' is-skipped' : cur ? ' is-current' : '';
          return (
            <div
              key={s.id}
              aria-label={`Шаг «${s.title}»${d ? ', выполнен' : sk ? ', отложен' : ''}`}
              {...pressable(() => onSelect(cur ? null : s.id))}
              style={hit.outer}
            >
              <span
                className={'ob-p-dot' + state}
                style={{ ...hit.inner, ...(cur && !d && !sk ? { background: current.color } : {}) }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
