import { escapeHtml } from '../utils/escape-html';

// Один упавший блок /stats не должен гасить весь отчёт, включая «Самопроверку»
// и «Переменные»: отчёт-наблюдатель, который падает вместе с наблюдаемым, —
// ровно тот сбой, при котором он нужнее всего (аудит 2026-10, infra#28).

/** Подстрока заглушки. Живой e2e и perf проверяют её отсутствие: устойчивый
 * отчёт не должен превращать битый запрос в зелёную джобу (правило №18). */
export const BLOCK_FAILED_MARK = 'посчитать не удалось';

const REASON_LIMIT = 100;

export interface SettleBlock {
  name: string;
  run: () => string | Promise<string>;
}

function reasonText(reason: unknown): string {
  // Объект без message в текст не превращаем: «[object Object]» — мусор.
  const raw =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : '';
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  // У Prisma первая строка — «Invalid `prisma.x()` invocation:», суть в конце.
  const line = lines.find((l) => !/invocation:$/.test(l)) ?? lines[0] ?? '';
  const chars = [...line];
  return chars.length > REASON_LIMIT
    ? `${chars.slice(0, REASON_LIMIT).join('')}…`
    : line;
}

/** Строка вместо упавшего блока. Обрезка — ДО экранирования: иначе рвётся
 * `&lt;`, а неэкранированное `<…>` из текста ошибки даёт Telegram 400 и
 * теряет уже весь кусок отчёта (parse_mode HTML). */
export function failedBlockLine(name: string, reason: unknown): string {
  const text = reasonText(reason);
  const head = `⚠️ <b>«${escapeHtml(name)}»</b>: ${BLOCK_FAILED_MARK}`;
  return text ? `${head} — ${escapeHtml(text)}` : head;
}

/** Считает все блоки; порядок сохраняется, упавший блок заменяется заглушкой.
 * warn, не error: error уходит админу в DM на каждый его же /stats, а причина
 * и так видна в самом отчёте. */
export async function settleBlocks(
  blocks: SettleBlock[],
  logger: { warn(msg: string): void },
): Promise<string[]> {
  // then(run): синхронный throw тоже становится rejected.
  const results = await Promise.allSettled(
    blocks.map((b) => Promise.resolve().then(b.run)),
  );
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const line = failedBlockLine(blocks[i].name, r.reason);
    logger.warn(
      `stats block "${blocks[i].name}" failed: ${reasonText(r.reason)}`,
    );
    return line;
  });
}
