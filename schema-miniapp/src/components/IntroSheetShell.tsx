import { useState, type ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { useIntroSheetData } from '../hooks/useIntroSheetData';
import { IntroSheetFlashcard, IntroSheetQuestion } from './IntroSheetFlashcard';
import { IntroSheetDone } from './IntroSheetDone';
import { IntroSheetHeader } from './IntroSheetHeader';
import { WizardProgress } from './WizardProgress';
import { WizardNav } from './WizardNav';

// Общий каркас интро-шита ModeIntroSheet/SchemaIntroSheet — заголовок,
// прогресс-бар, шаг с вопросом, навигация (правило №11 CLAUDE.md).
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
  /** Иконка слева от заголовка: эмодзи схемы или цветной кружок режима
   *  (`<IdentityDot color={...} />`, волна 6) — см. IntroSheetHeaderProps. */
  emoji: ReactNode;
  title: string;
  subtitle: string;
  description?: string;
  showDescription: boolean;
  /** Пояснение «откуда это и зачем» (правило онбординга) — мелким кеглем под
   *  шапкой/описанием, до первого действия пользователя. */
  explainer?: string;
  /** Доп. действие в шапке справа от названия (например «Про режим»). */
  headerAction?: ReactNode;
  /** Где искать карточку после сохранения — показывается на экране итога. */
  savedHint: string;
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
  headerAction,
  savedHint,
  nextButtonLabel,
  gradientSaveButton,
}: IntroSheetShellProps<T>) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const { data, set, handleSave, saving, saveError, hasAny } =
    useIntroSheetData({
      storageKey,
      emptyData,
      loadExisting,
      saveNote,
      onComplete,
    });

  const q = questions[step];
  const isLast = step === questions.length - 1;

  if (done)
    return (
      <BottomSheet onClose={onClose}>
        <IntroSheetDone
          questions={questions}
          data={data}
          accentColor={accentColor}
          savedHint={savedHint}
          onEdit={() => {
            setDone(false);
            setStep(0);
          }}
          onClose={onClose}
        />
      </BottomSheet>
    );

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <IntroSheetHeader
          emoji={emoji}
          title={title}
          subtitle={subtitle}
          accentColor={accentColor}
          description={description}
          showDescription={showDescription}
          explainer={explainer}
          headerAction={headerAction}
        />

        <div style={{ marginBottom: 20 }}>
          <WizardProgress
            segments={questions.map((question) => ({
              filled: data[question.key].trim().length > 0,
            }))}
            active={step}
            accentColor={accentColor}
            onSelect={setStep}
          />
        </div>

        {q && (
          <IntroSheetFlashcard
            step={step}
            totalSteps={questions.length}
            question={q}
            answer={data[q.key]}
            onChange={(value) => set(q.key, value)}
          />
        )}

        <div style={{ marginBottom: 16 }}>
          <WizardNav
            accentColor={accentColor}
            onBack={() => setStep((s) => Math.max(0, s - 1))}
            backDisabled={step === 0}
            primaryKind={isLast ? 'save' : 'next'}
            primaryLabel={
              isLast
                ? saving
                  ? 'Сохраняем…'
                  : saveError
                    ? 'Не сохранилось — попробовать ещё раз'
                    : 'Сохранить карточку'
                : nextButtonLabel
            }
            onPrimary={
              isLast
                ? () => void handleSave().then((ok) => ok && setDone(true))
                : () => setStep((s) => s + 1)
            }
            primaryDisabled={isLast ? !hasAny || saving : false}
            gradientSave={gradientSaveButton}
          />
          {isLast && !hasAny && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-faint)',
                lineHeight: 1.5,
                marginTop: 8,
                textAlign: 'center',
              }}
            >
              Чтобы сохранить, нужен хотя бы один ответ — любой, даже в одну
              строчку.
            </div>
          )}
        </div>

        <TherapyNote compact />
      </div>
    </BottomSheet>
  );
}
