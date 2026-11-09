import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { hueStyle } from '../lib/tone';
import { Dialog } from './Dialog';
import { ConsentWelcome } from './ConsentWelcome';
import { EntryHead, EntrySteps } from './paper/EntryHead';
import { PaperAlert } from './paper/PaperAlert';
import { CONSENT_HUES, CONSENT_LOOK, CONSENT_STEPS, type ConsentStep as Step } from './paper/entryLook';
import {
  CONSENT_NOT_THERAPY_CHECK, CONSENT_NOT_THERAPY_TEXT, CONSENT_NOT_THERAPY_TITLE,
  CONSENT_PRIVACY_CHECK, CONSENT_PRIVACY_PARAGRAPHS, CONSENT_PRIVACY_TITLE,
  consentHint, consentsReady,
} from '../../../shared/src/onboarding/consents';
import { ONBOARDING_STEP_EVENT, type OnboardingStep } from '../../../shared/src/share/analytics';
import '../styles/entry-flows.css';

interface Props {
  onAccept: () => void;
  /** Принять не удалось (сеть): показываем честную ошибку, экран остаётся. */
  failed: boolean;
}

// Первый вход из Telegram/MAX: приветствие и два согласия вместо тихого
// «принято». Порт шагов welcome/privacy/not_therapy визарда мини-аппа. Закрыть
// без согласия нельзя (нет onClose, поэтому и useHistorySheet не нужен: «Назад»
// браузера не должен обходить согласия), принять — только после обеих галочек.
// Шаги уходят в `onboarding_step` теми же именами, что в мини-аппе (воронка общая).
// Вид: окно с шапкой-листом бумаги шага (EntryHead, вид — paper/entryLook.ts), галочка — на
// плашке той же бумаги, сбой сохранения — PaperAlert, а не красная строка.
export function ConsentScreen({ onAccept, failed }: Props) {
  const tr = useTr();
  const [step, setStep] = useState<Step>('welcome');
  const [privacy, setPrivacy] = useState(false);
  const [notTherapy, setNotTherapy] = useState(false);
  const sent = useRef<Set<OnboardingStep>>(new Set());
  const ready = consentsReady(privacy, notTherapy);

  useEffect(() => {
    if (sent.current.has(step)) return;
    sent.current.add(step);
    api.trackEvent(ONBOARDING_STEP_EVENT, { step });
  }, [step]);

  function finish() {
    if (!ready) return;
    api.trackEvent(ONBOARDING_STEP_EVENT, { step: 'done' satisfies OnboardingStep });
    onAccept();
  }

  const at = CONSENT_STEPS.indexOf(step);
  const label = <><EntrySteps hues={CONSENT_HUES} at={at} />Шаг {at + 1} из 3</>;
  if (step === 'welcome') {
    return (
      <Dialog label="Приветствие" zIndex={400} maxWidth={540}>
        <ConsentWelcome label={label} onNext={() => setStep('privacy')} />
      </Dialog>
    );
  }
  const isPrivacy = step === 'privacy';
  const hint = isPrivacy ? null : consentHint(privacy, notTherapy, tr);
  return (
    <Dialog label="Согласия" zIndex={400} maxWidth={540}>
      <EntryHead look={CONSENT_LOOK[step]} label={label} title={isPrivacy ? CONSENT_PRIVACY_TITLE : CONSENT_NOT_THERAPY_TITLE} />
      <div className="sk-dialog-text ef-consent-text">
        {isPrivacy
          ? CONSENT_PRIVACY_PARAGRAPHS.map((p) => <p key={p}>{p}</p>)
          : <p>{CONSENT_NOT_THERAPY_TEXT}</p>}
        {isPrivacy && (
          <a className="ds-link ds-link--inline" href="/privacy" target="_blank" rel="noopener noreferrer">
            Политика конфиденциальности →
          </a>
        )}
      </div>
      <label className="pp-paper ef-check" style={hueStyle(CONSENT_LOOK[step].hue)}>
        <input
          type="checkbox"
          checked={isPrivacy ? privacy : notTherapy}
          onChange={(e) => (isPrivacy ? setPrivacy(e.target.checked) : setNotTherapy(e.target.checked))}
        />
        <span>{isPrivacy ? CONSENT_PRIVACY_CHECK : CONSENT_NOT_THERAPY_CHECK}</span>
      </label>
      {hint && <p className="ef-hint">{hint}</p>}
      {failed && (
        <PaperAlert className="ef-alert" title="Не получилось сохранить согласие." text={tr('Проверь сеть и попробуй ещё раз.', 'Проверьте сеть и попробуйте ещё раз.')} />
      )}
      <div className="sk-dialog-actions">
        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setStep(isPrivacy ? 'welcome' : 'privacy')}>
          Назад
        </button>
        {isPrivacy ? (
          <button type="button" className="ds-btn" disabled={!privacy} onClick={() => setStep('not_therapy')}>
            Далее
          </button>
        ) : (
          <button type="button" className="ds-btn" disabled={!ready} onClick={finish}>
            Начать
          </button>
        )}
      </div>
    </Dialog>
  );
}
