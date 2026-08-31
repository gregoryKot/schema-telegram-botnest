import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot } from './caseFlowUi';
import {
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
      className={'chip-pill ' + (active ? 'is-selected' : '')}
      style={{ minHeight: 40, padding: '8px 22px' }}
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
  const questions = buildCriterionQuestions(tr);
  const answered =
    criterion.biggerThanCause !== null && criterion.talkedDown !== null;
  const verdict = answered ? caseVerdict(criterion) : null;

  return (
    <ExScreen
      onBack={onBack}
      eyebrow="Разбор случая · Шаг 5 из 5"
      eyebrowColor="var(--accent-indigo)"
      title="Это была часть или обычная досада?"
    >
      {questions.map((q) => (
        <div key={q.key} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 10 }}>
            {q.text}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
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
        <div style={{ fontSize: 14, color: 'var(--accent)', lineHeight: 1.5, marginBottom: 8 }}>
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
