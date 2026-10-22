// Значение `run:` шага GitHub Actions таким, каким его получит shell — для
// гейта lockfile-audit (ревью регресса #814). Гейт судил о шаге по строкам
// YAML, а YAML склеивает строки plain- и folded-скаляра (`>`) пробелом:
// `run: node scripts/npm-audit.mjs webapp` и под ним строка `|| true` — это
// одна команда `… webapp || true`, заглушённый код выхода. Построчный разбор
// видел на первой строке «чистый» вызов и засчитывал шаг.
//
// yaml-парсера в зависимостях нет (workflow-yaml.ts), поэтому здесь
// упрощённая сборка скаляра, и упрощение только строже: где YAML оставил бы
// перевод строки (более глубокий отступ в `>`), склейка пробелом даёт ту же
// или более длинную строку — заглушённый вызов чистым от неё не становится.
// Плюс склейка `\`-продолжений shell (`… webapp \` + `|| true`).

const indentOf = (l: string): number => /^ */.exec(l)?.[0].length ?? 0;

/** `\`+перевод строки shell убирает: следующая строка — та же команда. */
export const joinContinuations = (script: string): string =>
  script.replace(/\\\n[ \t]*/g, ' ');

/** Строки plain/folded-скаляра: подряд — через пробел, пустая — перевод. */
function fold(parts: string[]): string {
  let out = '';
  for (const p of parts) {
    if (p === '') out += '\n';
    else out += out === '' || out.endsWith('\n') ? p : ` ${p}`;
  }
  return out.trim();
}

/**
 * Скрипт `run:` шага с настоящими отступами (ключи шага — на 8 пробелов)
 * или null, если `run:` у шага нет (шаг `uses:` скриптом не считается, что
 * бы ни лежало в его `with:`).
 */
export function runScript(step: string): string | null {
  const lines = step.split('\n');
  const at = lines.findIndex((l) => /^\s*(?:-\s+)?run:/.test(l));
  if (at < 0) return null;
  const m = /^(\s*)(-\s+)?run:[ \t]*(.*)$/.exec(lines[at]);
  if (!m) return null;
  const keyIndent = m[1].length + (m[2]?.length ?? 0);
  const body: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (l.trim() !== '' && indentOf(l) <= keyIndent) break;
    body.push(l);
  }
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  const header = m[3].trim();
  if (/^\|[-+0-9]*\s*(?:#.*)?$/.test(header)) {
    const cut = Math.min(
      ...body.filter((l) => l.trim()).map(indentOf),
      Number.MAX_SAFE_INTEGER,
    );
    return joinContinuations(body.map((l) => l.slice(cut)).join('\n'));
  }
  const folded = /^>[-+0-9]*\s*(?:#.*)?$/.test(header) ? [] : [header];
  return joinContinuations(fold([...folded, ...body.map((l) => l.trim())]));
}
