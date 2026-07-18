import { useState } from 'react';
import { pressable } from '../utils/a11y';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { useIntroSheetData } from '../hooks/useIntroSheetData';
import { IntroSheetFlashcard, IntroSheetQuestion } from './IntroSheetFlashcard';

// Общий каркас интро-шита ModeIntroSheet/SchemaIntroSheet — заголовок,
// прогресс-бар, флэшкарта вопроса, навигация (правило №11 CLAUDE.md).
// Различия между режимами и схемами передаются пропсами, UI не меняется.
export interface IntroSheetShellProps<T extends Record<string, string>> {
  onClose: () => void;
  onComplete?: () => void;
  storageKey: string;
  emptyData: T;
  questions: IntroSheetQuestion<T>[];
  loadExisting: () => Promise<T | null>;
  saveNote: (data: T) => Promise<unknown>;
  accentColor: string;
  emoji: string;
  title: string;
  subtitle: string;
  description?: string;
  showDescription: boolean;
  answerPromptText: string;
  nextButtonLabel: string;
  gradientSaveButton?: boolean;
}

export function IntroSheetShell<T extends Record<string, string>>({
  onClose,
  onComplete,
  storageKey,
  emptyData,
  questions,
  loadExisting,
  saveNote,
  accentColor,
  emoji,
  title,
  subtitle,
  description,
  showDescription,
  answerPromptText,
  nextButtonLabel,
  gradientSaveButton,
}: IntroSheetShellProps<T>) {
  const [step, setStep] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const { data, set, handleSave, saving, saved, hasAny } = useIntroSheetData({
    storageKey,
    emptyData,
    loadExisting,
    saveNote,
    onComplete,
  });

  const q = questions[step];
  const answer = q ? data[q.key] : '';

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              flexShrink: 0,
              background: `${accentColor}18`,
              border: `1px solid ${accentColor}28`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            {emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.3px',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: accentColor,
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>

        {showDescription && (
          <div
            style={{
              background: `${accentColor}0e`,
              border: `1px solid ${accentColor}22`,
              borderRadius: 16,
              padding: '12px 14px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
              }}
            >
              {description}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {questions.map((question, i) => {
            const filled = data[question.key].trim().length > 0;
            const active = i === step;
            return (
              <div
                key={i}
                {...pressable(() => {
                  setStep(i);
                  setFlipped(false);
                })}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  cursor: 'pointer',
                  background: filled
                    ? accentColor
                    : active
                      ? `${accentColor}55`
                      : 'var(--surface-2)',
                  transition: 'background 0.2s',
                }}
              />
            );
          })}
        </div>

        {q && (
          <IntroSheetFlashcard
            accentColor={accentColor}
            step={step}
            totalSteps={questions.length}
            question={q}
            answer={answer}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onUnflip={() => setFlipped(false)}
            onChange={(value) => set(q.key, value)}
            answerPromptText={answerPromptText}
          />
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => {
              setStep((s) => Math.max(0, s - 1));
              setFlipped(false);
            }}
            disabled={step === 0}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: 'none',
              fontFamily: 'inherit',
              background: step === 0 ? 'var(--surface)' : 'var(--surface-2)',
              color: step === 0 ? 'var(--text-faint)' : 'var(--text-sub)',
              fontSize: 18,
              cursor: step === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ←
          </button>

          {step < questions.length - 1 ? (
            <button
              onClick={() => {
                setStep((s) => s + 1);
                setFlipped(false);
              }}
              style={{
                flex: 1,
                padding: '13px',
                borderRadius: 12,
                border: 'none',
                fontFamily: 'inherit',
                background: `${accentColor}20`,
                color: accentColor,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {nextButtonLabel}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!hasAny || saving}
              style={{
                flex: 1,
                padding: '13px',
                borderRadius: 12,
                border: 'none',
                fontFamily: 'inherit',
                background: hasAny
                  ? gradientSaveButton
                    ? `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`
                    : accentColor
                  : 'var(--surface-2)',
                color: hasAny ? '#fff' : 'var(--text-faint)',
                fontSize: 14,
                fontWeight: 600,
                cursor: hasAny ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
            >
              {saving
                ? 'Сохраняем…'
                : saved
                  ? '✓ Сохранено'
                  : 'Сохранить карточку'}
            </button>
          )}
        </div>

        <TherapyNote compact />
      </div>
    </BottomSheet>
  );
}
