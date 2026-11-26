import { useEffect, useState } from 'react';
import { api } from '../../api';
import { planCountLabel, practiceCountLabel } from '../../../../shared/src/quickActions/catalogCountLabels';

const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];

export interface CatalogCounts {
  /** null — ещё не загрузилось или сбой: цифру не выдумываем. */
  practices: number | null;
  plans: number | null;
}

/** Подпись счётчика в строке «Каталога»: те же слова, что в «Инструментах» (toolRows). */
export function catalogCountLabel(kind: 'practices' | 'plans', count: number | null): string | null {
  if (count === null) return null;
  return kind === 'practices' ? practiceCountLabel(count) : planCountLabel(count);
}

/** Подзаголовок строки «Каталога»: «5 действий · пояснение»; без цифры — только пояснение. */
export function catalogRowSub(kind: 'practices' | 'plans', count: number | null, staticSub: string): string {
  const label = catalogCountLabel(kind, count);
  return label ? `${label} · ${staticSub}` : staticSub;
}

/** Сколько своих действий «Что питает» по всем потребностям и планов за 30 дней — из реальных данных. */
export function useCatalogCounts(): CatalogCounts {
  const [counts, setCounts] = useState<CatalogCounts>({ practices: null, plans: null });
  useEffect(() => {
    let ignore = false;
    const settle = <T>(load: () => Promise<T>) => Promise.resolve().then(load).then(v => v, () => null);
    void Promise.all([
      settle(() => Promise.all(NEED_IDS.map(id => api.getPractices(id))).then(r => r.reduce((n, a) => n + a.length, 0))),
      settle(() => api.getPlanHistory(30).then(p => p.length)),
    ]).then(([practices, plans]) => { if (!ignore) setCounts({ practices, plans }); });
    return () => { ignore = true; };
  }, []);
  return counts;
}
