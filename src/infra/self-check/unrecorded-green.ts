import { formatSelfCheck } from './format';
import type { SelfCheckSnapshot } from './state';

// Пробы, чей зелёный исход пока стоит на документации площадки, а не на
// записанном ответе: /stats показывает их detail, пока ответ не лёг в фикстуру.
const UNRECORDED_GREEN = new Set(['postbox', 'yandexOAuth']);

export function unrecordedGreen(snap: SelfCheckSnapshot): string {
  const lines = snap.results
    .filter(
      (r) => r.ok && UNRECORDED_GREEN.has(r.id) && r.detail !== 'выключено',
    )
    .map((r) => `• ${r.title}: ${r.detail}`);
  return lines.length
    ? `\nОтветы новых площадок (ждут записи в тесты):\n${lines.join('\n')}`
    : '';
}

/** Блок «Самопроверка» для /stats: отчёт и ответы незаписанных площадок. */
export function selfCheckBlock(snap: SelfCheckSnapshot): string {
  return formatSelfCheck(snap) + unrecordedGreen(snap);
}
