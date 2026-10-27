import { useState } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot } from './caseFlowUi';
import { TertiaryLink } from './caseLinks';
import { QuickPracticeSheet } from '../practice/QuickPracticeSheet';
import type { QuickResultView } from '../../../../shared/src/case/quick/caseQuick';
import '../../styles/case-quick.css';

/**
 * Итог разбора: предложенный режим, что собрали, что поможет сейчас. «Сохранить»
 * — это и согласие с режимом; сомнение уходит в «Не похоже — другие режимы».
 */
export function CaseResultStep({
  view,
  saving,
  failed,
  onBack,
  onSave,
  onDoubt,
  crisis,
  onHardNow,
}: {
  view: QuickResultView;
  saving: boolean;
  failed: boolean;
  onBack: () => void;
  onSave: () => void;
  onDoubt: () => void;
  crisis: boolean;
  onHardNow: () => void;
}) {
  const [breathing, setBreathing] = useState(false);
  return (
    <ExScreen
      onBack={onBack}
      backLabel="Назад"
      eyebrow="Похоже на режим"
      title={view.name}
    >
      {view.desc && <p className="ds-sub cq-desc">{view.desc}</p>}
      {view.need && (
        <p className="ds-sub cq-desc">Что ему нужно: {view.need}</p>
      )}

      <div className="ds-card cq-rows" aria-label="Что собрали">
        <div className="ds-label">Что собрали</div>
        {view.rows.map((r) => (
          <div key={r.label} className="cq-row">
            <span className="cq-row-label">{r.label}</span>
            <span className="cq-row-text">{r.text}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="ds-card ds-card--row ds-card--hover cq-calm"
        onClick={() => setBreathing(true)}
      >
        <span className="ds-label">Что поможет сейчас</span>
        <span className="cq-calm-text">Минута дыхания 4-4-6</span>
      </button>

      {failed && (
        <p role="alert" className="cq-error">
          Не удалось сохранить. Всё на месте — можно повторить.
        </p>
      )}

      <CaseFlowFoot
        primaryLabel={saving ? 'Сохраняю…' : 'Сохранить'}
        primaryDisabled={saving}
        onPrimary={onSave}
        crisis={crisis}
        onHardNow={onHardNow}
      >
        <TertiaryLink label="Не похоже — другие режимы" onClick={onDoubt} />
      </CaseFlowFoot>

      {breathing && (
        <QuickPracticeSheet
          id="breathing"
          onClose={() => setBreathing(false)}
        />
      )}
    </ExScreen>
  );
}
