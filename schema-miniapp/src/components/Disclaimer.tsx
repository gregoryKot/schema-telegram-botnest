import { useState } from 'react';
import { pressable } from '../utils/a11y';
import { hitboxStyle } from '../utils/hitbox';
import { BottomSheet } from './BottomSheet';
import { DisclaimerWelcomeStep } from './disclaimer/DisclaimerWelcomeStep';
import { DisclaimerPrivacyStep } from './disclaimer/DisclaimerPrivacyStep';
import { DisclaimerNotTherapyStep } from './disclaimer/DisclaimerNotTherapyStep';
import { DisclaimerHomeScreenStep } from './disclaimer/DisclaimerHomeScreenStep';
import { canOfferHomeScreenNow } from '../utils/homeScreen';
import { buildSteps, canAdvance, initialStepIndex } from './disclaimer/steps';
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
  // не показываем повторно, открываемся сразу на «добавить на экран» (или на
  // последнем доступном шаге, если он недоступен — см. initialStepIndex).
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
    home_screen: <DisclaimerHomeScreenStep onBeforeAdd={onConsent} />,
    done: null,
  }[stepId];

  const blocked = !canAdvance(stepId, ready);

  return (
    <BottomSheet dismissable={false} zIndex={300}>
      {/* Step dots */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-8)',
          marginBottom: 24,
        }}
      >
        {steps.map((id, i) => {
          const dotW = i === step ? 20 : 8;
          return (
            <div
              key={id}
              {...pressable(() => setStep(i))}
              style={hitboxStyle(dotW, 8, 24).outer}
            >
              <div
                style={{
                  ...hitboxStyle(dotW, 8, 24).inner,
                  borderRadius: 'var(--r-4)',
                  background:
                    i === step
                      ? 'var(--accent)'
                      : i < step
                        ? 'rgba(var(--fg-rgb),0.3)'
                        : 'rgba(var(--fg-rgb),0.12)',
                  transition: 'all 0.25s ease',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ minHeight: 260 }}>{content}</div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 'var(--space-10)', marginTop: 20 }}>
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 'var(--r-14)',
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
              // Прогресс сохраняем на КАЖДОМ шаге, а не только на шаге
              // согласий: у кого согласие уже есть (бот, сайт), юридические
              // шаги пропускаются, и до финальной кнопки могло не дойти —
              // человек листал экраны, закрывал мини-апп и проходил онбординг
              // заново. Вызов идемпотентен (см. persist в useOnboardingGate).
              onConsent();
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
              // Свод 2026-08-31 сократил визард до 4 шагов: без home_screen
              // (canAddToHome=false) not_therapy — теперь последний шаг, и
              // финальная кнопка обязана держать тот же гейт согласий, что
              // раньше проверяла только «Далее →» — иначе обе галочки можно
              // было не ставить вовсе.
              if (blocked) return;
              trackOnboardingDone();
              onAccept();
            }}
            className="btn-primary"
            style={{ flex: 2, opacity: blocked ? 0.35 : 1 }}
          >
            {canAddToHome ? 'Пропустить и начать' : 'Начать'}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
