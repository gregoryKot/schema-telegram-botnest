// Правила и чистые функции для гейта check-agent-docs.mjs. Вынесены из движка,
// чтобы тот не рос (правило №10: гейт делится на движок + модуль правил, как
// gendered-forms-patterns.mjs). Здесь нет чтения диска — только текст в текст,
// поэтому каждую функцию можно проверить напрямую (agent-docs.spec.ts).

// ── Бюджеты ─────────────────────────────────────────────────────────────────
// CLAUDE.md грузится в КАЖДУЮ сессию целиком (до сжатия — около 99k знаков),
// правила из .claude/rules/ — только когда агент трогает файлы из их `paths`.
export const MAX_CLAUDE_LINES = 200;
export const MAX_CLAUDE_VISIBLE = 16000;
export const MAX_RULE_VISIBLE = 24000;

// ── Что пропускать при обходе дерева ────────────────────────────────────────
// Верхний уровень: dot-каталоги пропускаются отдельно (по первому символу).
export const SKIP_TOP = new Set(['node_modules', 'dist', 'coverage', 'build']);
// Каталоги внутри src/ и т.п.: сборка, кэш и снимки — не модули.
export const SKIP_SUB = new Set([
  'node_modules',
  'dist',
  'coverage',
  '__snapshots__',
  '.jest-cache',
]);
// Обход .claude/: worktrees — чужие копии репозитория (в .gitignore), их
// документы не наши.
export const SKIP_CLAUDE = new Set([...SKIP_SUB, 'worktrees']);
// Корни, чьи прямые подкаталоги карта обязана назвать полным путём.
export const MAP_SUBDIR_ROOTS = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];
// Сегменты пути, которых в чистом чекауте может не быть (артефакты сборки):
// токен `webapp/dist/` в тексте — не протухший путь.
export const GENERATED_SEGMENTS = new Set(['node_modules', 'dist', 'coverage', 'build']);

/** Число строк так, как считает `wc -l` для файла с переводом строки в конце. */
export function countLines(text) {
  if (text === '') return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

/** Текст без блочных HTML-комментариев: Claude Code вырезает их перед
 *  подстановкой в контекст, поэтому в бюджет они не входят. */
export function visibleText(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

function unquote(s) {
  const t = s.trim();
  const m = t.match(/^(["'])(.*)\1$/);
  return (m ? m[2] : t).trim();
}

/** Frontmatter правила: `null`, если файл не начинается с `---`-блока, иначе
 *  `{ paths: string[] }` (пустой массив — ключа нет или значение пустое).
 *  Понимает `paths: "glob"`, `paths: ["a", "b"]` и список `  - "glob"`. */
export function parseFrontmatter(text) {
  const m = text
    .replace(/^﻿/, '')
    .match(/^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/);
  if (!m) return null;
  const lines = (m[1] ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => /^paths\s*:/.test(l));
  if (at < 0) return { paths: [] };
  const inline = lines[at].replace(/^paths\s*:/, '').trim();
  const items = [];
  if (inline.startsWith('[') && inline.endsWith(']')) {
    items.push(...inline.slice(1, -1).split(','));
  } else if (inline) {
    items.push(inline);
  } else {
    for (const l of lines.slice(at + 1)) {
      const li = l.match(/^\s+-\s*(.*)$/);
      if (li) items.push(li[1]);
      else if (/^\S/.test(l)) break; // следующий ключ frontmatter
    }
  }
  return { paths: items.map(unquote).filter(Boolean) };
}

/** Заменяет содержимое ограждённых блоков кода (``` и ~~~) пустыми строками,
 *  сохраняя число строк — номера строк находок остаются настоящими. */
export function blankFences(text) {
  let fence = null;
  return text
    .split('\n')
    .map((line) => {
      const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fence) {
        if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
        return '';
      }
      if (m) {
        fence = m[1];
        return '';
      }
      return line;
    })
    .join('\n');
}

// Строка в обратных кавычках: открывающая и закрывающая цепочки одной длины,
// внутри не пустая строка (абзац) — как в CommonMark.
const CODE_SPAN = /(?<!`)(`+)(?!`)((?:(?!\n[ \t]*\n)[\s\S])+?)(?<!`)\1(?!`)/g;

/** Токены `…` вне ограждённых блоков (без обрамляющих пробелов). */
export function inlineCodeTokens(text) {
  return [...blankFences(text).matchAll(CODE_SPAN)].map((m) => m[2].trim());
}

/** Текст без ограждённых блоков и строк-в-кавычках; переводы строк остаются. */
export function stripCode(text) {
  return blankFences(text).replace(CODE_SPAN, (s) => s.replace(/[^\n]/g, ' '));
}

const LINK = /\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

/** Markdown-ссылки `[текст](цель)` вне кода: [{ target, line }]. */
export function markdownLinks(text) {
  const clean = stripCode(text);
  return [...clean.matchAll(LINK)].map((m) => ({
    target: m[1],
    line: clean.slice(0, m.index).split('\n').length,
  }));
}

/** Относительный путь цели ссылки (без #якоря, ?запроса и :строки) либо null,
 *  если проверять нечего: внешняя ссылка, чистый якорь, путь от корня сайта. */
export function linkFilePath(target) {
  if (/^(?:https?|mailto|tel|ftp|data):/i.test(target)) return null;
  if (target.startsWith('#') || target.startsWith('/')) return null;
  const bare = target
    .replace(/#.*$/, '')
    .replace(/\?.*$/, '')
    .replace(/(?::\d+)+(?:-\d+)?$/, '');
  if (!bare) return null;
  try {
    return decodeURIComponent(bare);
  } catch {
    return bare;
  }
}

// Знаки, по которым токен — шаблон, а не путь: глоб, заглушка, перечисление.
const PLACEHOLDER = /[*<>{}…|\s]|\.\.\./;

/** Путь из токена в обратных кавычках либо null: токен не про файл репозитория
 *  (чужой префикс), шаблон/глоб или путь в каталоге сборки. `roots` — имена
 *  каталогов верхнего уровня (без «/»), `.github` и `.claude` добавляются. */
export function tokenRepoPath(token, roots) {
  if (PLACEHOLDER.test(token)) return null;
  const bare = token.replace(/#.*$/, '').replace(/(?::\d+)+(?:-\d+)?$/, '');
  const prefixes = [...roots, '.github', '.claude'];
  if (!prefixes.some((p) => bare.startsWith(`${p}/`))) return null;
  if (bare.split('/').some((seg) => GENERATED_SEGMENTS.has(seg))) return null;
  return bare;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Названа ли в тексте директория полным путём `dir/`. Подпуть чужого корня не
 *  засчитывается: `shared/src/pages/` не закрывает `src/pages/`. */
export function mentionsDir(text, dir) {
  return new RegExp(`(?<![\\w-])(?<![\\w-]/)${escapeRe(dir)}/`).test(text);
}

/** Упомянут ли файл по имени (`check-foo.mjs`), не как часть другого имени. */
export function mentionsFile(text, name) {
  return new RegExp(`(?<![\\w-])${escapeRe(name)}(?![\\w-])`).test(text);
}
