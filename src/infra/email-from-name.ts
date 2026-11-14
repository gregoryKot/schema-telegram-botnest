/**
 * «Имя <адрес>» с не-ASCII в имени → имя словом RFC 2047 (`=?UTF-8?B?…?=`):
 * заголовок From несёт только ASCII. Без угловых скобок или с ASCII-именем — как есть.
 */
export function encodeFromName(from: string): string {
  const m = /^\s*"?(.*?)"?\s*<([^<>]+)>\s*$/.exec(from);
  if (!m || /^[\x20-\x7e]*$/.test(m[1])) return from;
  const word = Buffer.from(m[1], 'utf8').toString('base64');
  return `=?UTF-8?B?${word}?= <${m[2]}>`;
}
