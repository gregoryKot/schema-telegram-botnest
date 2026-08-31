// Резка длинного текста под лимит Telegram (4096 символов на сообщение).
//
// Зачем. Второе сообщение /stats склеивает семнадцать блоков без нарезки, и
// переполнение роняет ВЕСЬ отчёт в catch — из-за одной новой строки в нём.
// Автоматического сплиттера в проекте не было.
//
// Режем по границам блоков (`\n\n`), затем по строкам (`\n`), в последнюю
// очередь — по символам. HTML-тег атомарен (не рвём литерал `<b>`), а пару
// `<b>…</b>`, разорванную границей, дозакрываем в конце куска и переоткрываем
// в начале следующего — иначе незакрытый тег Telegram отвергает целиком (400
// на parse_mode). Место под служебные закрывашки резервируется ЗАРАНЕЕ: иначе
// балансировка добавила бы теги в кусок, уже стоящий на лимите, и сама выбила
// бы его за 4096 (разбор 2026-08-31).
import { Context } from 'telegraf';

export const TELEGRAM_LIMIT = 4096;

// Токен целиком — открывающий или закрывающий тег (с атрибутами). Для нарезки
// (matchAll) — без якорей; для классификации токена — с якорями.
const TAG_G = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?>/g;
const IS_TAG = /^<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?>$/;

const nameOf = (tag: string): string => /^<\/?([a-zA-Z0-9-]+)/.exec(tag)![1];
const isClose = (tag: string): boolean => tag[1] === '/';

/** Строка → атомы: целый тег либо кусок текста без тегов. Тег не рвётся. */
function tokenize(text: string): string[] {
  const out: string[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG_G)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(m[0]);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function splitForTelegram(
  text: string,
  limit = TELEGRAM_LIMIT,
): string[] {
  if (text.length <= limit) return [text];
  const out: string[] = [];
  const open: string[] = []; // открытые теги на текущем курсоре
  const closers = () => open.map((t) => `</${nameOf(t)}>`).reverse().join('');
  const reopen = () => open.join('');
  let chunk = reopen();
  let dirty = false; // добавляли ли содержимое после последнего сброса
  const flush = () => {
    if (!dirty) return;
    out.push(chunk + closers());
    chunk = reopen();
    dirty = false;
  };
  const room = () => limit - chunk.length - closers().length;
  const addText = (input: string) => {
    let s = input;
    while (s) {
      if (room() <= 0) flush();
      const r = room();
      if (s.length <= r) {
        chunk += s;
        dirty = true;
        return;
      }
      // Предпочитаем разрыв по `\n\n`, затем по `\n`, иначе жёстко по символам.
      const head = s.slice(0, r + 1);
      let cut = head.lastIndexOf('\n\n');
      let drop = 2;
      if (cut <= 0) [cut, drop] = [head.lastIndexOf('\n'), 1];
      if (cut <= 0) [cut, drop] = [r, 0];
      chunk += s.slice(0, cut);
      dirty = true;
      flush();
      s = s.slice(cut + drop);
    }
  };
  for (const tok of tokenize(text)) {
    if (!IS_TAG.test(tok)) {
      addText(tok);
    } else if (isClose(tok)) {
      chunk += tok;
      dirty = true;
      const i = open.map(nameOf).lastIndexOf(nameOf(tok));
      if (i >= 0) open.splice(i, 1);
    } else {
      // Тег и его будущая закрывашка обязаны влезть в кусок целиком.
      const need = tok.length + closers().length + `</${nameOf(tok)}>`.length;
      if (chunk.length + need > limit) flush();
      chunk += tok;
      dirty = true;
      open.push(tok);
    }
  }
  flush();
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
