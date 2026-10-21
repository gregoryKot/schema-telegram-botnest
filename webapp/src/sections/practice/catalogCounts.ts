import { useEffect, useState } from 'react';
import { api } from '../../api';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';

const NEED_IDS = ['attachment', 'autonomy', 'expression', 'play', 'limits'];

export interface CatalogCounts {
  /** null — ещё не загрузилось или сбой: цифру не выдумываем. */
  practices: number | null;
  plans: number | null;
}

/** Подпись счётчика в строке «Каталога»: те же слова, что в мини-аппе (toolRows). */
export function catalogCountLabel(kind: 'practices' | 'plans', count: number | null): string | null {
  if (count === null) return null;
  if (kind === 'practices') {
    return count === 0 ? 'Нет практик' : `${count} ${pluralRu(count, 'практика', 'практики', 'практик')}`;
  }
  return count === 0 ? 'История пуста' : `${count} ${pluralRu(count, 'план', 'плана', 'планов')}`;
}

/** Подзаголовок строки «Каталога»: «5 практик · пояснение»; без цифры — только пояснение. */
export function catalogRowSub(kind: 'practices' | 'plans', count: number | null, staticSub: string): string {
  const label = catalogCountLabel(kind, count);
  return label ? `${label} · ${staticSub}` : staticSub;
}

/** Сколько практик по всем потребностям и планов за 30 дней — из реальных данных. */
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
