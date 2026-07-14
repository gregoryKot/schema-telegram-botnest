import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { DisclaimerWelcomeStep } from './disclaimer/DisclaimerWelcomeStep';
import { DisclaimerPrivacyStep } from './disclaimer/DisclaimerPrivacyStep';
import { DisclaimerNotTherapyStep } from './disclaimer/DisclaimerNotTherapyStep';
import { DisclaimerAuthorStep } from './disclaimer/DisclaimerAuthorStep';
import { DisclaimerHomeScreenStep } from './disclaimer/DisclaimerHomeScreenStep';

export function Disclaimer({ onAccept }: { onAccept: () => void }) {
  const [step, setStep] = useState(0);
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const canAddToHome = !!(window as any).Telegram?.WebApp?.addToHomeScreen;
  const TOTAL = canAddToHome ? 5 : 4;
  const ready = c1 && c2;

  const steps = [
    <DisclaimerWelcomeStep key={0} />,
    <DisclaimerPrivacyStep key={1} c2={c2} setC2={setC2} />,
    <DisclaimerNotTherapyStep key={2} c1={c1} setC1={setC1} />,
    <DisclaimerAuthorStep key={3} ready={ready} c1={c1} c2={c2} />,
    <DisclaimerHomeScreenStep key={4} />,
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
            onClick={() => setStep(i)}
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
              if (step === 3 && !ready) return;
              setStep((s) => s + 1);
            }}
            className="btn-primary"
            style={{ flex: 2, opacity: step === 3 && !ready ? 0.35 : 1 }}
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
