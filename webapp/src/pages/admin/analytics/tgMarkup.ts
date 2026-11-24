// Разбор разметки Telegram из отчёта: только b/i/code, остальное — текстом (без innerHTML).
export interface MarkupSeg { text: string; b?: boolean; i?: boolean; code?: boolean }

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"' };
const decode = (s: string) => s.replace(/&(?:lt|gt|amp|quot);/g, (m) => ENTITIES[m]);
const TAG = /<(\/?)(b|i|code)>/g;

export function parseTgMarkup(src: string): MarkupSeg[] {
  const open = { b: 0, i: 0, code: 0 };
  const out: MarkupSeg[] = [];
  const push = (raw: string) => {
    if (!raw) return;
    const seg: MarkupSeg = { text: decode(raw) };
    if (open.b) seg.b = true;
    if (open.i) seg.i = true;
    if (open.code) seg.code = true;
    const last = out[out.length - 1];
    if (last && last.b === seg.b && last.i === seg.i && last.code === seg.code) last.text += seg.text;
    else out.push(seg);
  };
  let pos = 0;
  for (const m of src.matchAll(TAG)) {
    const name = m[2] as 'b' | 'i' | 'code';
    const closing = m[1] === '/';
    push(src.slice(pos, m.index));
    pos = m.index + m[0].length;
    if (!closing) open[name] += 1;
    else if (open[name] > 0) open[name] -= 1;
    else push(m[0]); // закрывающий тег без пары остаётся текстом
  }
  push(src.slice(pos));
  return out;
}
