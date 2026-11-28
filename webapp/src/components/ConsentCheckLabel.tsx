import { CONSENT_CHECK_LINK, CONSENT_CHECK_REST } from '../../../shared/src/onboarding/consents';

/** Подпись галочки согласия на обработку ПДн: «Даю согласие» ведёт на текст согласия (/consent). Одна на вход сайта и экран согласий. */
export function ConsentCheckLabel() {
  return (
    <span>
      <a href="/consent" target="_blank" rel="noopener noreferrer">{CONSENT_CHECK_LINK}</a>
      {CONSENT_CHECK_REST}
    </span>
  );
}
