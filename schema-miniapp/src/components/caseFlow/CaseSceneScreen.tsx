import { useState } from 'react';
import { haptic } from '../../haptic';
import { DiaryTextArea } from '../diary/DiaryTextArea';
import { PrimaryAction } from '../diary/diaryFlowUi';
import { TertiaryLink } from './caseFlowUi';
import {
  CASE_FRAMES,
  buildFrameHint,
  buildScenePlaceholder,
  hasOwnDetail,
} from '../../../../shared/src/case/caseFrames';
import { buildModeDiarySteps } from '../../../../shared/src/mode/modeDiarySteps';
import type { Tr } from '../../../../shared/src/case/caseTypes';

/**
 * Шаг 1 из 5 — единственное текстовое поле всего потока. Подсказка берётся
 * из buildModeDiarySteps (та же формулировка, что и в дневнике режимов) —
 * третья копия одного и того же текста запрещена правилом №11 CLAUDE.md.
 */
export function CaseSceneScreen({
  value,
  chosenFrame,
  onChange,
  onPickFrame,
  onNext,
  tr,
}: {
  value: string;
  chosenFrame: string;
  onChange: (v: string) => void;
  onPickFrame: (frame: string) => void;
  onNext: () => void;
  tr: Tr;
}) {
  const [showFrames, setShowFrames] = useState(false);
  const hint = buildModeDiarySteps(tr).find((s) => s.key === 'situation')!.hint;
  const canNext = hasOwnDetail(value, chosenFrame);

  return (
    <div>
      <div
        id="case-scene-question"
        className="d-display"
        style={{ fontSize: 21, marginBottom: 8 }}
      >
        Что случилось?
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        {hint}
      </div>

      {chosenFrame && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--accent)',
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          {buildFrameHint(tr)}
        </div>
      )}

      <DiaryTextArea
        value={value}
        onChange={onChange}
        placeholder={buildScenePlaceholder(tr)}
        rows={4}
        labelId="case-scene-question"
      />

      <TertiaryLink
        label={showFrames ? 'Скрыть рамки ▲' : 'Не идёт — взять рамку →'}
        onClick={() => setShowFrames((v) => !v)}
      />

      {showFrames && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-8)',
            marginBottom: 12,
          }}
        >
          {CASE_FRAMES.map((frame) => (
            <button
              key={frame}
              onClick={() => {
                haptic.tap();
                onPickFrame(frame);
                setShowFrames(false);
              }}
              className="d-row"
              style={{ textAlign: 'left' }}
            >
              {frame}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <PrimaryAction label="Дальше" disabled={!canNext} onClick={onNext} />
      </div>
    </div>
  );
}
