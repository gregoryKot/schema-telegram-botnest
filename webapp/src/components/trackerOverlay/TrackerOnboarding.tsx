// Онбординг трекера (3 карточки) — паритет с мини-аппом. Показывается там,
// где живёт трекер, пока нет ни одной оценки и карточку не закрывали
// (флаг в localStorage, как в мини-аппе). Контент — shared/needs/trackerOnboarding.
import { useState } from 'react';
import { useTr } from '../../utils/addressForm';
import {
  buildTrackerOnboardingSteps,
  TRACKER_ONBOARDING_KEY,
  TRACKER_ORIGIN_NOTE,
} from '../../../../shared/src/needs/trackerOnboarding';
import '../../styles/sheet-tracker.css';

export function TrackerOnboarding({ eligible }: { eligible: boolean }) {
  const tr = useTr();
  // Решение «показывать» фиксируется при открытии: первая же оценка не должна
  // убирать карточку из-под пальца посреди чтения.
  const [open, setOpen] = useState(() => eligible && !localStorage.getItem(TRACKER_ONBOARDING_KEY));
  const [step, setStep] = useState(0);
  if (!open) return null;
  const steps = buildTrackerOnboardingSteps(tr);
  const cur = steps[step];
  const last = step === steps.length - 1;
  const dismiss = () => {
    localStorage.setItem(TRACKER_ONBOARDING_KEY, '1');
    setOpen(false);
  };
  return (
    <div className="ds-card tk2-onb" role="region" aria-label="Как работает трекер">
      <div className="ds-sub">{TRACKER_ORIGIN_NOTE}</div>
      <div className="tk2-onb-body">
        <span className="tk2-onb-emoji" aria-hidden="true">{cur.emoji}</span>
        <div>
          <div className="tk2-onb-title">{cur.title}</div>
          <div className="ds-sub">{cur.text}</div>
        </div>
      </div>
      <div className="tk2-onb-foot">
        <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={dismiss}>Пропустить</button>
        <span className="tk2-onb-count">{step + 1} / {steps.length}</span>
        <button className="ds-btn ds-btn--sm" onClick={() => (last ? dismiss() : setStep(step + 1))}>
          {last ? 'Понятно, начнём' : 'Далее →'}
        </button>
      </div>
    </div>
  );
}
