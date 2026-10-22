import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot } from './caseFlowUi';
import {
  buildCriterionIntro,
  buildCriterionQuestions,
  buildVerdictReply,
  caseVerdict,
} from '../../../../shared/src/case/caseCriterion';
import type {
  CaseCriterionAnswers,
  Tr,
} from '../../../../shared/src/case/caseTypes';

function YesNoChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={'ds-chip ex2-chip ex2-chip--yn' + (active ? ' is-selected' : '')}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/** Шаг 5 из 5 — критерий Jacob как два тапа вместо абзаца теории. Twin
 *  schema-miniapp CaseCriterionScreen.tsx. */
export function CaseCriterionScreen({
  criterion,
  onAnswer,
  onBack,
  onNext,
  onLater,
  saving,
  crisis,
  onHardNow,
  tr,
}: {
  criterion: CaseCriterionAnswers;
  onAnswer: (key: keyof CaseCriterionAnswers, value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onLater: () => void;
  saving: boolean;
  crisis: boolean;
  onHardNow: () => void;
  tr: Tr;
}) {
  const intro = buildCriterionIntro(tr);
  const questions = buildCriterionQuestions(tr);
  const answered =
    criterion.biggerThanCause !== null && criterion.talkedDown !== null;
  const verdict = answered ? caseVerdict(criterion) : null;

  return (
    <ExScreen
      onBack={onBack}
      eyebrow="Разбор случая · Шаг 5 из 5"
      title={intro.title}
      lede={intro.sub}
    >
      {questions.map((q) => (
        <div key={q.key} className="ds-card ds-card--row ex2-question">
          <div className="ex2-question-text">{q.text}</div>
          <div className="ex2-chips">
            <YesNoChip
              active={criterion[q.key] === true}
              label="Да"
              onClick={() => onAnswer(q.key, true)}
            />
            <YesNoChip
              active={criterion[q.key] === false}
              label="Нет"
              onClick={() => onAnswer(q.key, false)}
            />
          </div>
        </div>
      ))}

      {verdict && (
        <div className="ex2-verdict">
          {buildVerdictReply(tr)[verdict]}
        </div>
      )}

      <CaseFlowFoot
        primaryLabel={saving ? 'Сохраняю…' : 'Дальше'}
        primaryDisabled={!answered || saving}
        onPrimary={onNext}
        onLater={onLater}
        crisis={crisis}
        onHardNow={onHardNow}
      />
    </ExScreen>
  );
}
