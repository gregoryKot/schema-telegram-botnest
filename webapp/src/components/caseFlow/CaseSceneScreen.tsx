import { useRef, useState, useEffect } from 'react';
import { haptic } from '../../haptic';
import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot } from './caseFlowUi';
import {
  CASE_FRAMES,
  buildFrameHint,
  buildFramesToggle,
  buildScenePlaceholder,
  hasOwnDetail,
} from '../../../../shared/src/case/caseFrames';
import { buildModeDiarySteps } from '../../../../shared/src/mode/modeDiarySteps';
import type { Tr } from '../../../../shared/src/case/caseTypes';

/**
 * Шаг 1 из 5 — единственное текстовое поле всего потока. Подсказка берётся
 * из buildModeDiarySteps (та же формулировка, что и в дневнике режимов) —
 * третья копия одного и того же текста запрещена правилом №11 CLAUDE.md.
 * Twin schema-miniapp CaseSceneScreen.tsx.
 *
 * Детекция сцены (правило №7) — в общем shared/src/case/useCaseFlowState.ts
 * (`crisis` включает fields.scene), CrisisCard рисует CaseFlowFoot ниже на
 * этом же экране, пока человек печатает. Этот файл — дочерний <textarea>-
 * контрол в терминах security-трипваера (src/security/crisis-path.invariants.spec.ts),
 * поэтому он в NON_THERAPEUTIC_ALLOWLIST рядом с DiaryTextArea.tsx — та же
 * причина, «детекция в родительском компоненте», не выдуманный обход гейта
 * (правило №15).
 */
export function CaseSceneScreen({
  value,
  chosenFrame,
  onChange,
  onPickFrame,
  onBack,
  onNext,
  onLater,
  crisis,
  onHardNow,
  tr,
}: {
  value: string;
  chosenFrame: string;
  onChange: (v: string) => void;
  onPickFrame: (frame: string) => void;
  onBack: () => void;
  onNext: () => void;
  onLater: () => void;
  crisis: boolean;
  onHardNow: () => void;
  tr: Tr;
}) {
  const [showFrames, setShowFrames] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    areaRef.current?.focus();
  }, []);
  const hint = buildModeDiarySteps(tr).find((s) => s.key === 'situation')!.hint;
  const canNext = hasOwnDetail(value, chosenFrame);

  return (
    <ExScreen
      onBack={onBack}
      eyebrow="Разбор случая · Шаг 1 из 5"
      title="Что случилось?"
      lede={hint}
    >
      {chosenFrame && (
        <div className="ex2-verdict">
          {buildFrameHint(tr)}
        </div>
      )}

      <textarea
        ref={areaRef}
        className="ds-textarea"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={buildScenePlaceholder(tr)}
        aria-label="Что случилось?"
      />

      <button
        type="button"
        className="ds-btn ex2-ghost ex2-gap"
        onClick={() => setShowFrames((v) => !v)}
      >
        {buildFramesToggle(showFrames)}
      </button>

      {showFrames && (
        <div className="ex2-stack">
          {CASE_FRAMES.map((frame) => (
            <button
              key={frame}
              type="button"
              className="ds-card ds-card--row ds-card--hover ex2-frame"
              onClick={() => {
                haptic.tap();
                onPickFrame(frame);
                setShowFrames(false);
              }}
            >
              {frame}
            </button>
          ))}
        </div>
      )}

      <CaseFlowFoot
        primaryLabel="Дальше"
        primaryDisabled={!canNext}
        onPrimary={onNext}
        onLater={onLater}
        crisis={crisis}
        onHardNow={onHardNow}
      />
    </ExScreen>
  );
}
