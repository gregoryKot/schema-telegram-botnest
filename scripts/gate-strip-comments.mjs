// Общий сканер комментариев для гейтов, которым нужно стирать `//` и
// `/* */`, СОХРАНЯЯ переводы строк (номера строк в отчёте не съезжают —
// приём взят из scripts/second-person-blanking.mjs). Вынесено из
// check-render-poison.mjs, чтобы check-color-drift.mjs не заводил свою
// третью копию — gate-sandbox.ts копирует локальные `./*.mjs`-зависимости
// скрипта в песочницу (withLocalDeps), так что общий модуль работает и в
// тестах, и в CI без склейки файлов вручную.
export function stripComments(text, isCss) {
  const n = text.length;
  let out = '';
  let i = 0;
  let quote = null;
  while (i < n) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && i + 1 < n) {
        out += text[i + 1] === '\n' ? '\n' : ' ';
        i += 2;
        continue;
      }
      out += c;
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    // В CSS `//` комментарием НЕ является: строка `url(https://…)` в одном
    // объявлении с размытием прятала бы его от гейта (найдено ревью
    // 2026-08-26). Там режем только `/* */`.
    if (!isCss && c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
