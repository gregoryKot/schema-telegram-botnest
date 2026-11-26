// Выраженность схем YSQ в данных с сервера — для экранов терапевта на обеих
// площадках (таблица «Схемы» и «Сверка с YSQ» на сайте, блок истории YSQ в
// мини-аппе). Источник критерия — бэкенд (`active` в src/utils/ysq.ts), сюда
// приходит готовый флаг. До 2026-10 экраны терапевта считали «активна» как
// `pct5plus > 50` и сортировали по % «5–6»: схема, выраженная у клиента по
// среднему баллу (сплошные «4»), у терапевта была серым 0% (QA 2026-10-26).
import { isSchemaScoreActive } from '../hooks/ysqScoring';
export { avgBarPct } from '../hooks/ysqScoring';

export interface YsqServerScore {
  id: string;
  pct5plus: number;
  avg?: number;
  active?: boolean;
}

/**
 * Флаг бэкенда; у ответа без флага (закэшированный ответ прошлой версии) —
 * тот же критерий из shared, сверенный с бэкендом тестом
 * webapp/src/hooks/useYsqTest.test.ts.
 */
export function isServerScoreActive(s: YsqServerScore): boolean {
  return s.active ?? isSchemaScoreActive(s);
}

/** Выраженные первыми, внутри — по среднему баллу, затем по доле «5–6» (как «Выраженные схемы» у клиента). */
export function sortByExpression<T extends YsqServerScore>(
  scores: readonly T[],
): T[] {
  return scores
    .map((s, i) => ({ s, i, on: isServerScoreActive(s) ? 1 : 0 }))
    .sort(
      (a, b) =>
        b.on - a.on ||
        (b.s.avg ?? 0) - (a.s.avg ?? 0) ||
        b.s.pct5plus - a.s.pct5plus ||
        a.i - b.i,
    )
    .map((x) => x.s);
}

/** Средний балл подписью «4/6»; нет балла — «–» (не выдумываем). */
export function ysqAvgLabel(avg: number | undefined): string {
  return avg && avg > 0 ? `${avg}/6` : '–';
}
