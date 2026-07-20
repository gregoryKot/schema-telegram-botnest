import { useState } from 'react';
import { pressable } from '../utils/a11y';
import { BottomSheet } from './BottomSheet';
import { DisclaimerWelcomeStep } from './disclaimer/DisclaimerWelcomeStep';
import { DisclaimerNeedsStep } from './disclaimer/DisclaimerNeedsStep';
import { DisclaimerPrivacyStep } from './disclaimer/DisclaimerPrivacyStep';
import { DisclaimerNotTherapyStep } from './disclaimer/DisclaimerNotTherapyStep';
import { DisclaimerAuthorStep } from './disclaimer/DisclaimerAuthorStep';
import { DisclaimerHomeScreenStep } from './disclaimer/DisclaimerHomeScreenStep';
import { canOfferHomeScreenNow } from '../utils/homeScreen';

export function Disclaimer({
  onAccept,
  onConsent,
  consentGiven = false,
}: {
  onAccept: () => void;
  // Согласие персистится здесь, а не в финальной кнопке: последний шаг
  // («добавить на экран») уводит пользователя из аппки, и раньше согласие
  // терялось — при заходе с ярлыка онбординг начинался заново.
  onConsent: () => void;
  // Согласие уже дано раньше (напр. в боте/на сайте) — тогда онбординг
  // остаётся образовательным, но галочки не заставляем ставить заново.
  consentGiven?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [c1, setC1] = useState(consentGiven);
  const [c2, setC2] = useState(consentGiven);
  const canAddToHome = canOfferHomeScreenNow();
  const TOTAL = canAddToHome ? 6 : 5;
  const ready = c1 && c2;
  // Шаг «Об авторе» — на нём собираются согласия, до них дальше не пускаем.
  const CONSENT_STEP = 4;

  const steps = [
    <DisclaimerWelcomeStep key={0} />,
    <DisclaimerNeedsStep key={1} />,
    <DisclaimerPrivacyStep key={2} c2={c2} setC2={setC2} />,
    <DisclaimerNotTherapyStep key={3} c1={c1} setC1={setC1} />,
    <DisclaimerAuthorStep key={4} ready={ready} c1={c1} c2={c2} />,
    <DisclaimerHomeScreenStep key={5} onBeforeAdd={onConsent} />,
  ];

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
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div
            key={i}
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
      <div style={{ minHeight: 260 }}>{steps[step]}</div>

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
        {step < TOTAL - 1 ? (
          <button
            onClick={() => {
              if (step === CONSENT_STEP && !ready) return;
              // Согласие сохраняем сразу, как только оно дано: дальше идёт шаг
              // «добавить на экран», с которого пользователь уходит из аппки.
              if (step === CONSENT_STEP) onConsent();
              setStep((s) => s + 1);
            }}
            className="btn-primary"
            style={{
              flex: 2,
              opacity: step === CONSENT_STEP && !ready ? 0.35 : 1,
            }}
          >
            Далее →
          </button>
        ) : (
          <button
            onClick={onAccept}
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
