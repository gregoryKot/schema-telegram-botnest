// Общие части текстового экспорта связей (режимы и схемы): строка поля с
// переносом продолжения под метку и названия по списку id в порядке реестра.
export const INDENT = '  ';

/** Многострочный текст: продолжение строки сдвигается под метку. */
export function oneField(label: string, value: string): string[] {
  const v = value.trim();
  if (!v) return [];
  return [`${INDENT}${label}: ${v.split('\n').join(`\n${INDENT}${INDENT}`)}`];
}

export function names(
  ids: string[],
  all: { id: string; name: string }[],
): string {
  const set = new Set(ids);
  return all
    .filter((x) => set.has(x.id))
    .map((x) => x.name)
    .join(' · ');
}
