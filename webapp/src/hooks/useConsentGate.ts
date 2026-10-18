import { useCallback, useEffect, useState } from 'react';
import { api, reportClientError } from '../api';
import { wasLoginConsentShown } from '../auth/loginConsent';

export type ConsentState = 'checking' | 'needed' | 'done';

// Согласия при первом входе. Раньше сайт принимал их молча на старте, и
// человек, которого Telegram/MAX впустил автоматически, ни разу не видел
// текста. Теперь `acceptDisclaimer()` зовётся только из `accept()`, то есть
// после явных двух галочек экрана согласий. Исключение — кто видел экран
// входа сайта с текстом согласия: ему принимаем тихо, как раньше.
// Сбой проверки не запирает кабинет (экран не нужен тому, у кого уже есть
// согласие), но уходит наверх отчётом (правило №14).
export function useConsentGate() {
  const [state, setState] = useState<ConsentState>('checking');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const finish = (s: ConsentState) => { if (alive) setState(s); };
    api.getDisclaimer()
      .then(async (d) => {
        if (d.accepted) return finish('done');
        if (!wasLoginConsentShown()) return finish('needed');
        await api.acceptDisclaimer();
        finish('done');
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
      await api.acceptDisclaimer();
      setState('done');
    } catch {
      setFailed(true);
    }
  }, []);

  return { state, accept, failed };
}
