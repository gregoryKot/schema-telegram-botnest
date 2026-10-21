import { useEffect } from 'react';
import { markLoginConsentShown } from '../auth/loginConsent';

/** Экран входа показан: текст согласия на нём виден (см. auth/loginConsent). */
export function useLoginConsentMark(): void {
  useEffect(() => {
    markLoginConsentShown();
  }, []);
}
