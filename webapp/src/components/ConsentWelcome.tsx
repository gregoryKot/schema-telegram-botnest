import { useTr } from '../utils/addressForm';
import { welcomeTexts } from '../../../shared/src/onboarding/consents';

// Шаг-приветствие экрана согласий: как первый экран визарда мини-аппа
// (DisclaimerWelcomeStep). Тексты — shared/src/onboarding/consents.ts.
export function ConsentWelcome({ onNext }: { onNext: () => void }) {
  const t = welcomeTexts(useTr());
  return (
    <>
      <h2 className="ds-h2 sk-dialog-title">{t.title}</h2>
      <span className="ef-beta">{t.beta}</span>
      <div className="sk-dialog-text ef-consent-text">
        <p>{t.greeting}</p>
        <p>{t.intro}</p>
        <p>{t.outro}</p>
      </div>
      <div className="sk-dialog-actions">
        <button type="button" className="ds-btn" onClick={onNext}>Далее</button>
      </div>
    </>
  );
}
