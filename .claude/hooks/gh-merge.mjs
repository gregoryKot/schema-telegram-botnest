// Мерж PR через Bash для сторожа контекста (context-guard.mjs): вызов `gh pr merge`,
// а не упоминание в кавычках или heredoc. PostToolUse приходит только на код выхода 0.

const CALL = /\bgh\s+pr\s+merge\b([^;&|\n)]*)/g;
const HEREDOC = /<<-?[ \t]*(['"]?)(\w+)\1([^\n]*)\n(?:[\s\S]*?\n)?[ \t]*\2[ \t]*(?=\n|$)/g;
const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g;

/** 'merged' — мерж, 'auto' — автомерж (PR вмержен сразу или после CI), '' — не мерж. */
export function mergeKind(command) {
  const code = String(command ?? '')
    .replace(HEREDOC, '$3')
    .replace(QUOTED, "''");
  let kind = '';
  for (const [, args] of code.matchAll(CALL)) {
    if (/--disable-auto\b/.test(args)) continue;
    if (!/--auto\b/.test(args)) return 'merged';
    kind = 'auto';
  }
  return kind;
}

/** Bash-вызов из события PostToolUse; фоновая команда ещё не кончилась — исхода нет. */
export function bashMerge(input) {
  if (input.tool_response?.backgroundTaskId) return '';
  return mergeKind(input.tool_input?.command);
}
