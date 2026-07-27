import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { useIntroSheetData } from '../hooks/useIntroSheetData';
import { IntroSheetFlashcard, IntroSheetQuestion } from './IntroSheetFlashcard';
import { WizardProgress } from './WizardProgress';
import { WizardNav } from './WizardNav';

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
  /** Пояснение «откуда это и зачем» (правило онбординга) — мелким кеглем под
   *  шапкой/описанием, до первого действия пользователя. */
  explainer?: string;
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
  explainer,
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

        {explainer && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-faint)',
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            {explainer}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <WizardProgress
            segments={questions.map((question) => ({
              filled: data[question.key].trim().length > 0,
            }))}
            active={step}
            accentColor={accentColor}
            onSelect={(i) => {
              setStep(i);
              setFlipped(false);
            }}
          />
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

        <div style={{ marginBottom: 16 }}>
          <WizardNav
            accentColor={accentColor}
            onBack={() => {
              setStep((s) => Math.max(0, s - 1));
              setFlipped(false);
            }}
            backDisabled={step === 0}
            primaryKind={step < questions.length - 1 ? 'next' : 'save'}
            primaryLabel={
              step < questions.length - 1
                ? nextButtonLabel
                : saving
                  ? 'Сохраняем…'
                  : saved
                    ? '✓ Сохранено'
                    : 'Сохранить карточку'
            }
            onPrimary={
              step < questions.length - 1
                ? () => {
                    setStep((s) => s + 1);
                    setFlipped(false);
                  }
                : handleSave
            }
            primaryDisabled={
              step < questions.length - 1 ? false : !hasAny || saving
            }
            gradientSave={gradientSaveButton}
          />
        </div>

        <TherapyNote compact />
      </div>
    </BottomSheet>
  );
}
