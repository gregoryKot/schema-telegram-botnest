import { useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import type { UserSettings } from '../../../../shared/src/apiTypes';
import { shouldShowReminderHint } from './reminderHintRules';
import { hasReminderHintSeen } from './reminderHintSeen';

export type ReminderHintState = 'checking' | 'show' | 'skip';

/** Грузит настройки только когда очередь дошла до шага и флага нет; сбой — не показываем, флаг не ставим. */
export function useReminderHint(active: boolean): { state: ReminderHintState; settings: UserSettings | null } {
  const [state, setState] = useState<ReminderHintState>(() => (hasReminderHintSeen() ? 'skip' : 'checking'));
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    if (!active || state !== 'checking') return;
    let alive = true;
    Promise.resolve(api.getSettings())
      .then((s) => {
        if (!alive) return;
        setSettings(s);
        setState(shouldShowReminderHint(hasReminderHintSeen(), s) ? 'show' : 'skip');
      })
      .catch(() => {
        reportClientError({ message: 'reminder hint: настройки не загрузились', section: 'appshell.bootstrap' });
        if (alive) setState('skip');
      });
    return () => { alive = false; };
  }, [active, state]);

  return { state, settings };
}
