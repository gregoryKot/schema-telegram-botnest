import { useEffect, useState } from 'react';
import { api } from '../../../api';

/** «Мои» схемы из профиля: чипы сперва показывают их. Грузится, только когда выбор схемы нужен. */
export function useActiveSchemaIds(enabled: boolean): string[] | undefined {
  const [ids, setIds] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    if (!enabled || ids) return;
    let cancelled = false;
    api.getProfile()
      .then((p) => { if (!cancelled) setIds(p.ysq.activeSchemaIds); })
      .catch(() => { /* профиль вспомогательный: без него просто показываем все схемы */ });
    return () => { cancelled = true; };
  }, [enabled, ids]);
  return ids;
}
