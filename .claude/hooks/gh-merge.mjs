// Мерж PR через Bash для сторожа контекста (context-guard.mjs): вызов `gh pr merge`,
// а не упоминание в кавычках или heredoc. PostToolUse приходит только на код выхода 0.
import { execFileSync } from 'node:child_process';

const CALL = /\bgh\s+pr\s+merge\b([^;&|\n)]*)/g;
const HEREDOC = /<<-?[ \t]*(['"]?)(\w+)\1([^\n]*)\n(?:[\s\S]*?\n)?[ \t]*\2[ \t]*(?=\n|$)/g;
const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g;
const VALUE_FLAG = /^(-[tbFRA]|--(subject|body|body-file|match-head-commit|repo|author-email))$/;
// Бюджет хука — 5 с (.claude/settings.json); переменная — для теста таймаута.
const VIEW_TIMEOUT = Number(process.env.CLAUDE_GH_VIEW_TIMEOUT_MS) || 3000;

const strip = (command) =>
  String(command ?? '')
    .replace(HEREDOC, '$3')
    .replace(QUOTED, "''");

/** 'merged' — мерж, 'auto' — автомерж (PR вмержен сразу или после CI), '' — не мерж. */
export function mergeKind(command) {
  let kind = '';
  for (const [, args] of strip(command).matchAll(CALL)) {
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

/** Вызов `gh pr merge` перед `|` (код выхода пайпа — от последней команды): { target, repo } или null. */
export function pipedMerge(command) {
  const code = strip(command);
  for (const m of code.matchAll(CALL)) {
    // `2>&1 |`: аргументы обрываются на `&`, пайп — за перенаправлением.
    const rest = code.slice(m.index + m[0].length);
    if (!/^(&\d+[ \t]*)?\|(?!\|)/.test(rest) || /--disable-auto\b/.test(m[1])) continue;
    const call = { target: '', repo: '' };
    const tokens = m[1].trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (VALUE_FLAG.test(t)) {
        if (/^(-R|--repo)$/.test(t)) call.repo = tokens[i + 1] ?? '';
        i++;
      } else if (t.startsWith('--repo=')) call.repo = t.slice(7);
      else if (/^\d*[<>]/.test(t)) i += /^\d*[<>]+$/.test(t) ? 1 : 0;
      else if (!t.startsWith('-') && !call.target) call.target = t;
    }
    return call;
  }
  return null;
}

const runGh = (args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    timeout: VIEW_TIMEOUT,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

/** Исход мержа за пайпом по состоянию PR: { kind, warning }; gh не ответил — kind '' и предупреждение. */
export function verifyMerge({ target, repo }, run = runGh) {
  const fail = (why) => ({
    kind: '',
    warning:
      `СТОРОЖ СЕССИИ: исход \`gh pr merge\` за пайпом не проверен (${why}) — ` +
      `проверь сам: gh pr view ${target} --json state,autoMergeRequest.`,
  });
  if (/^''$|\$/.test(target)) return fail('номер PR в переменной или кавычках');
  const args = ['pr', 'view', ...(target ? [target] : []), '--json', 'state,autoMergeRequest'];
  try {
    const { state, autoMergeRequest } = JSON.parse(run(repo ? [...args, '--repo', repo] : args));
    if (state === 'MERGED') return { kind: 'merged', warning: '' };
    return { kind: state === 'OPEN' && autoMergeRequest ? 'auto' : '', warning: '' };
  } catch (e) {
    return fail(e?.code === 'ETIMEDOUT' ? 'таймаут gh pr view' : 'gh pr view не ответил');
  }
}
