// Блок «Поиск» для /stats (правило №8): чистый форматтер, покрыт тестом с пустой БД; язык простой.
import {
  SEARCH_RESULT_KINDS,
  type SearchResultKind,
} from '../analytics/cabinet-events.constants';
import { SEARCH_KIND_LABELS } from './search-metrics.kinds';

export interface SearchMetrics {
  byKind30: Record<SearchResultKind, number>; // за месяц открыли из общего поиска, по виду результата
  typed30: number; // из них — после того, как набрали запрос (остальное выбрано из списка без набора)
  recent30: number; // из них — из списка недавно открытого
}

export function formatSearchMetrics(m: SearchMetrics): string {
  const head = '🔎 <b>Поиск</b> (за месяц)';
  const shown = SEARCH_RESULT_KINDS.filter((k) => m.byKind30[k] > 0);
  const total = shown.reduce((sum, k) => sum + m.byKind30[k], 0);
  if (total === 0) return `${head}\nЧерез поиск пока ничего не открывали.`;
  const parts = shown.map((k) => `${SEARCH_KIND_LABELS[k]} — ${m.byKind30[k]}`);
  const lines = [head, `Открыли результатов: ${total} (${parts.join(', ')})`];
  if (m.typed30 > 0) lines.push(`Из них набрав запрос: ${m.typed30}`);
  if (m.recent30 > 0) lines.push(`Из них из недавнего: ${m.recent30}`);
  return lines.join('\n');
}
