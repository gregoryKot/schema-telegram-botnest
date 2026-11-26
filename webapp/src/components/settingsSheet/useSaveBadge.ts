import { useCallback, useState } from 'react';
import { useTimedFlag } from '../../../../shared/src/hooks/useTimedFlag';

// Бейдж «Сохранено ✓ / Не сохранилось» в шапке настроек сайта. QA 2026-11
// (М3): текст и цвет зависели от флага ошибки, а видимость — от любого из
// двух флагов. Флаг ошибки гас раньше конца анимации исчезновения, и на
// последние 0,3 с бейдж «Не сохранилось» перекрашивался в зелёное
// «Сохранено ✓». Теперь вид — последний исход, а гаснет только видимость.
export type SaveOutcome = 'ok' | 'err';

export function useSaveBadge() {
  const [savedOn, flashSavedOn] = useTimedFlag(1800);
  const [errorOn, flashErrorOn] = useTimedFlag(2400);
  const [outcome, setOutcome] = useState<SaveOutcome>('ok');

  const flashSaved = useCallback(() => {
    setOutcome('ok');
    flashSavedOn();
  }, [flashSavedOn]);
  const flashError = useCallback(() => {
    setOutcome('err');
    flashErrorOn();
  }, [flashErrorOn]);

  return { visible: savedOn || errorOn, outcome, flashSaved, flashError };
}
