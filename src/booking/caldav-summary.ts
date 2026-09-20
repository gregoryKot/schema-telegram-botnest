// Раз-экранирование SUMMARY (RFC 5545) — зеркало escapeText из
// caldav-event.util.ts, только в обратную сторону. Отдельный файл — иначе
// caldav-busy.ts (в храповике на 87 строк) пробил бы потолок.
const MAX_SUMMARY_LEN = 120;

/** SUMMARY уже unfolded-текста VEVENT: раз-экранированный, со схлопнутыми
 *  пробелами и обрезанный. undefined — если поля нет или оно пустое. */
export function readSummary(ev: string): string | undefined {
  const m = ev.match(/(?:^|\n)SUMMARY(?:;[^:\n]*)?:([^\r\n]*)/);
  if (!m) return undefined;
  const text = unescapeText(m[1]).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > MAX_SUMMARY_LEN
    ? `${text.slice(0, MAX_SUMMARY_LEN)}…`
    : text;
}

/** \n/\N → пробел, \, → `,`, \; → `;`, \\ → `\`. Один проход регэкспа —
 *  порядок безопасен: replace не пересканирует уже вставленный текст. */
function unescapeText(raw: string): string {
  return raw.replace(
    /\\([\\;,nN])/g,
    (_match: string, escaped: string): string =>
      escaped === 'n' || escaped === 'N' ? ' ' : escaped,
  );
}
