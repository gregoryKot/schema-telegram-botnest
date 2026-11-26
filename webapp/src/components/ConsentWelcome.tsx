import type { ReactNode } from 'react';
import { useTr } from '../utils/addressForm';
import { welcomeTexts } from '../../../shared/src/onboarding/consents';
import { HeroCollage } from './art/HeroCollage';
import { EntryHead } from './paper/EntryHead';
import { CONSENT_LOOK } from './paper/entryLook';

// Шаг-приветствие экрана согласий (DisclaimerWelcomeStep мини-аппа; тексты — shared/src/onboarding/consents.ts):
// после лендинга кабинет встречает тем же образом — лист персика с компактным коллажем первого экрана, бета — наклейкой.
export function ConsentWelcome({ label, onNext }: { label: ReactNode; onNext: () => void }) {
  const t = welcomeTexts(useTr());
  return (
    <>
      <EntryHead look={CONSENT_LOOK.welcome} scene={{ art: <HeroCollage compact />, hue: CONSENT_LOOK.welcome.hue, sticker: t.beta }} label={label} title={t.title} />
      <div className="sk-dialog-text ef-consent-text">
        <p>{t.greeting}</p><p>{t.intro}</p><p>{t.outro}</p>
      </div>
      <div className="sk-dialog-actions"><button type="button" className="ds-btn" onClick={onNext}>Далее</button></div>
    </>
  );
}
