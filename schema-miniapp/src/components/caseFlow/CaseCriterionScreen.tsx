import { PrimaryAction } from '../diary/diaryFlowUi';
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

function YesNoButton({
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
      onClick={onClick}
      className="sel-btn"
      style={{
        flex: 1,
        minHeight: 44,
        borderRadius: 'var(--r-12)',
        border: active
          ? '1px solid var(--accent)'
          : '1px solid rgba(34,30,27,0.1)',
        background: active ? 'var(--accent-bg)' : 'var(--surface)',
        color: active ? 'var(--accent)' : 'var(--ink-2)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/** Шаг 5 из 5 — критерий Jacob как два тапа вместо абзаца теории. */
export function CaseCriterionScreen({
  criterion,
  onAnswer,
  onNext,
  saving,
  tr,
}: {
  criterion: CaseCriterionAnswers;
  onAnswer: (key: keyof CaseCriterionAnswers, value: boolean) => void;
  onNext: () => void;
  saving: boolean;
  tr: Tr;
}) {
  const intro = buildCriterionIntro(tr);
  const questions = buildCriterionQuestions(tr);
  const answered =
    criterion.biggerThanCause !== null && criterion.talkedDown !== null;
  const verdict = answered ? caseVerdict(criterion) : null;

  return (
    <div>
      <div className="d-display" style={{ fontSize: 21, marginBottom: 8 }}>
        {intro.title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        {intro.sub}
      </div>

      {questions.map((q) => (
        <div key={q.key} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 10 }}>
            {q.text}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
            <YesNoButton
              active={criterion[q.key] === true}
              label="Да"
              onClick={() => onAnswer(q.key, true)}
            />
            <YesNoButton
              active={criterion[q.key] === false}
              label="Нет"
              onClick={() => onAnswer(q.key, false)}
            />
          </div>
        </div>
      ))}

      {verdict && (
        <div
          style={{
            fontSize: 14,
            color: 'var(--accent)',
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          {buildVerdictReply(tr)[verdict]}
        </div>
      )}

      <PrimaryAction
        label={saving ? 'Сохраняю…' : 'Дальше'}
        disabled={!answered || saving}
        onClick={onNext}
      />
    </div>
  );
}
