import { reportClientError } from '../../api';
import { describeFailure } from '../../../../shared/src/api/describeFailure';
import { linkFailOutcome, type LinkFailOutcome } from './linkFailModel';

const LINK_SECTION = 'link-device';
const REPORT_WINDOW_MS = 60_000;
let lastReportAt = -Infinity;

/** Сводка билета не загрузилась — экран-тупик шлёт отчёт наверх (правило №14, check-dead-end-report), как
 *  подписка по ссылке: 4xx (код не найден, устарел, лимит) — ожидаемый исход wait, без отчёта; остальное —
 *  our_side с отчётом. В отчёте только статус или тип сбоя (describeFailure): ни кода билета, ни текста
 *  ответа. Троттлинг — не чаще раза в минуту на вкладку: ремаунт и смена токена не шлют повтор. */
export function reportLinkPreviewFailure(e: unknown, now = Date.now()): LinkFailOutcome {
  const outcome = linkFailOutcome(e);
  if (outcome === 'our_side' && now - lastReportAt >= REPORT_WINDOW_MS) {
    lastReportAt = now;
    reportClientError({ message: `link preview failed: ${describeFailure(e)}`, section: LINK_SECTION });
  }
  return outcome;
}

/** Только для тестов: сброс окна троттлинга. */
export function resetLinkReportThrottle() { lastReportAt = -Infinity; }
