import { useCallback, useEffect, useState } from 'react';
import { api, reportClientError } from '../api';
import { takeLoginConsent } from '../auth/loginConsent';
import { CONSENT_VERSION } from '../../../shared/src/onboarding/consents';

// `renew` — согласие есть, но на старую редакцию текста: экран спрашивает заново, без приветствия.
export type ConsentState = 'checking' | 'needed' | 'renew' | 'done';

// Согласие — действие человека. Экран показывается, пока на сервере нет согласия на ТЕКУЩУЮ
// редакцию (CONSENT_VERSION). Тихо принимаем только то, что человек отметил галочкой на экране
// входа сайта (`auth/loginConsent`) и притом на эту же редакцию; сам показ текста согласием не считается.
// Сбой проверки не запирает кабинет (экран не нужен тому, у кого уже есть согласие), но уходит
// наверх отчётом (правило №14).
export function useConsentGate() {
  const [state, setState] = useState<ConsentState>('checking');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const finish = (s: ConsentState) => { if (alive) setState(s); };
    api.getDisclaimer()
      .then(async (d) => {
        const given = takeLoginConsent(); // отметка одноразовая — в любом исходе успешного GET
        if (d.accepted && d.version === CONSENT_VERSION) return finish('done');
        if (given === CONSENT_VERSION) {
          await api.acceptDisclaimer(CONSENT_VERSION);
          return finish('done');
        }
        finish(d.accepted ? 'renew' : 'needed');
      })
      .catch(() => {
        reportClientError({ message: 'consent gate: проверка согласий не удалась', section: 'appshell.bootstrap' });
        finish('done');
      });
    return () => { alive = false; };
  }, []);

  const accept = useCallback(async () => {
    setFailed(false);
    try {
      await api.acceptDisclaimer(CONSENT_VERSION);
      setState('done');
    } catch {
      setFailed(true);
    }
  }, []);

  return { state, accept, failed };
}
