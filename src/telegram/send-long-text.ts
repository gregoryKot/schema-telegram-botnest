// Резка длинного текста под лимит Telegram (4096 символов на сообщение).
//
// Зачем. Второе сообщение /stats склеивает семнадцать блоков без какой-либо
// нарезки, и переполнение роняет ВЕСЬ отчёт в catch — из-за одной новой
// строки в нём. Автоматического сплиттера в проекте не было.
//
// Режем по границам блоков (`\n\n`): блок отчёта, разорванный посередине,
// читается хуже, чем два сообщения. Кусок, который сам длиннее лимита, режем
// по строкам, а совсем неделимую строку — по символам, но НЕ внутри HTML-тега:
// оборванный `<b>` Telegram отвергает целиком (400 на parse_mode).
import { Context } from 'telegraf';

export const TELEGRAM_LIMIT = 4096;

/** Не рвём внутри `<…>`: оборванный тег ломает разбор всего сообщения. */
function safeCut(chunk: string, limit: number): number {
  const open = chunk.lastIndexOf('<', limit - 1);
  const close = chunk.lastIndexOf('>', limit - 1);
  // Тег начался и не закрылся до границы — режем перед ним.
  return open > close && open > 0 ? open : limit;
}

function splitHard(text: string, limit: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const cut = safeCut(rest, limit);
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

export function splitForTelegram(text: string, limit = TELEGRAM_LIMIT) {
  if (text.length <= limit) return [text];
  const out: string[] = [];
  let current = '';
  for (const block of text.split('\n\n')) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    // Сам блок не влезает — режем его по строкам, потом по символам.
    if (block.length > limit) {
      let piece = '';
      for (const line of block.split('\n')) {
        const next = piece ? `${piece}\n${line}` : line;
        if (next.length <= limit) {
          piece = next;
          continue;
        }
        if (piece) out.push(piece);
        piece = line.length > limit ? '' : line;
        if (line.length > limit) out.push(...splitHard(line, limit));
      }
      current = piece;
    } else {
      current = block;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Отправляет текст столькими сообщениями, сколько нужно. */
export async function replyLong(
  ctx: Context,
  text: string,
  extra?: Parameters<Context['reply']>[1],
): Promise<void> {
  for (const chunk of splitForTelegram(text)) {
    await ctx.reply(chunk, extra);
  }
}
