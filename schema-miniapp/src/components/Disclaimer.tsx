import { useState } from 'react';
import { pressable } from '../utils/a11y';
import { BottomSheet } from './BottomSheet';
import { DisclaimerWelcomeStep } from './disclaimer/DisclaimerWelcomeStep';
import { DisclaimerPrivacyStep } from './disclaimer/DisclaimerPrivacyStep';
import { DisclaimerNotTherapyStep } from './disclaimer/DisclaimerNotTherapyStep';
import { DisclaimerNeedsWhatStep } from './disclaimer/DisclaimerNeedsWhatStep';
import { DisclaimerNeedsWhyStep } from './disclaimer/DisclaimerNeedsWhyStep';
import { DisclaimerNeedsResultStep } from './disclaimer/DisclaimerNeedsResultStep';
import { DisclaimerTodayScreenStep } from './disclaimer/DisclaimerTodayScreenStep';
import { DisclaimerAuthorStep } from './disclaimer/DisclaimerAuthorStep';
import { DisclaimerHomeScreenStep } from './disclaimer/DisclaimerHomeScreenStep';
import { canOfferHomeScreenNow } from '../utils/homeScreen';
import {
  buildSteps,
  canAdvance,
  initialStepIndex,
  CONSENT_STEP,
} from './disclaimer/steps';
import {
  useOnboardingStepTracking,
  trackOnboardingDone,
} from '../hooks/useOnboardingStepTracking';

export function Disclaimer({
  onAccept,
  onConsent,
  consentGiven = false,
}: {
  onAccept: () => void;
  // Согласие персистится здесь, а не в финальной кнопке: шаг «добавить на
  // экран» уводит пользователя из аппки, и раньше согласие терялось — при
  // заходе с ярлыка онбординг начинался заново.
  onConsent: () => void;
  // Согласие уже дано раньше (бот, сайт, другое устройство) — юридические шаги
  // не показываем повторно, открываемся сразу на содержательной части.
  consentGiven?: boolean;
}) {
  const canAddToHome = canOfferHomeScreenNow();
  const [steps] = useState(() => buildSteps(canAddToHome));
  const [step, setStep] = useState(() => initialStepIndex(steps, consentGiven));
  const [c1, setC1] = useState(consentGiven);
  const [c2, setC2] = useState(consentGiven);
  const ready = c1 && c2;
  const stepId = steps[step];
  const isLast = step === steps.length - 1;

  useOnboardingStepTracking(stepId);

  const content = {
    welcome: <DisclaimerWelcomeStep />,
    privacy: <DisclaimerPrivacyStep c2={c2} setC2={setC2} />,
    not_therapy: (
      <DisclaimerNotTherapyStep c1={c1} setC1={setC1} ready={ready} c2={c2} />
    ),
    needs_what: <DisclaimerNeedsWhatStep />,
    needs_why: <DisclaimerNeedsWhyStep />,
    needs_result: <DisclaimerNeedsResultStep />,
    today_screen: <DisclaimerTodayScreenStep />,
    author: <DisclaimerAuthorStep />,
    home_screen: <DisclaimerHomeScreenStep onBeforeAdd={onConsent} />,
    done: null,
  }[stepId];

  const blocked = !canAdvance(stepId, ready);

  return (
    <BottomSheet onClose={() => {}} zIndex={300}>
      {/* Step dots */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 24,
        }}
      >
        {steps.map((id, i) => (
          <div
            key={id}
            {...pressable(() => setStep(i))}
            style={{
              width: i === step ? 20 : 8,
              height: 8,
              borderRadius: 4,
              background:
                i === step
                  ? 'var(--accent)'
                  : i < step
                    ? 'rgba(var(--fg-rgb),0.3)'
                    : 'rgba(var(--fg-rgb),0.12)',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div style={{ minHeight: 260 }}>{content}</div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 14,
              border: 'none',
              background: 'rgba(var(--fg-rgb),0.07)',
              color: 'var(--text-sub)',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            ← Назад
          </button>
        )}
        {!isLast ? (
          <button
            onClick={() => {
              if (blocked) return;
              // Согласие сохраняем сразу, как только обе галочки стоят: дальше
              // человек может уйти из аппки, не дойдя до финальной кнопки.
              if (stepId === CONSENT_STEP) onConsent();
              setStep((s) => s + 1);
            }}
            className="btn-primary"
            style={{ flex: 2, opacity: blocked ? 0.35 : 1 }}
          >
            Далее →
          </button>
        ) : (
          <button
            onClick={() => {
              trackOnboardingDone();
              onAccept();
            }}
            className="btn-primary"
            style={{ flex: 2 }}
          >
            {canAddToHome ? 'Пропустить и начать' : 'Начать'}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
