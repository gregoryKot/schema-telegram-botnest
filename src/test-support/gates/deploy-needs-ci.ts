// Правила гейта «деплой ждёт CI» (аудит 2026-10, quality#35). Чистые функции
// над текстом воркфлоу: yaml-парсера в зависимостях нет, а нужные места
// (`on:`, job-level `if:`) в репозитории плоские и однотипные. Прогон по
// настоящим файлам и контрольные образцы — deploy-needs-ci.spec.ts.

const DEPLOY_MARKS = /\b(?:ops\.sh|ssh-setup\.sh|scp|ssh vps)\b/;
/** Единственные триггеры воркфлоу, который ходит на боевой сервер. */
const SAFE_EVENTS = ['workflow_run', 'workflow_dispatch'];

export const stripComments = (text: string): string =>
  text
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

/** Воркфлоу ходит на сервер: ssh/scp или фиксированные операции ops.sh. */
export const isDeployWorkflow = (text: string): boolean =>
  DEPLOY_MARKS.test(stripComments(text));

/** Блок `on:` по событиям: { push: '…строки под ключом…', … }. */
export function triggerBlocks(text: string): Record<string, string> {
  const lines = stripComments(text).split('\n');
  const start = lines.findIndex((l) => /^["']?on["']?:/.test(l));
  if (start < 0) return {};
  const inline = lines[start].replace(/^["']?on["']?:\s*/, '').trim();
  if (inline) {
    const names = inline.replace(/[[\]]/g, '').split(',');
    return Object.fromEntries(
      names.map((n) => [n.trim(), '']).filter(([n]) => n),
    );
  }
  const body: string[] = [];
  for (const l of lines.slice(start + 1)) {
    if (l.trim() && !/^\s/.test(l)) break;
    body.push(l);
  }
  const blocks: Record<string, string> = {};
  let key = '';
  for (const l of body) {
    const m = /^ {2}([\w-]+):(.*)$/.exec(l);
    if (m) {
      key = m[1];
      blocks[key] = m[2];
    } else if (key) {
      blocks[key] += '\n' + l;
    }
  }
  return blocks;
}

/** Job-level `if:` каждой джобы (многострочный `>-` склеивается). */
export function jobConditions(text: string): Record<string, string> {
  const src = stripComments(text);
  const at = src.search(/^jobs:\s*$/m);
  if (at < 0) return {};
  const out: Record<string, string> = {};
  for (const part of src
    .slice(at)
    .split(/^ {2}(?=[\w-]+:\s*$)/m)
    .slice(1)) {
    const id = part.slice(0, part.indexOf(':'));
    const cond = /^ {4}if:[ \t]*(.*(?:\n {5,}.*)*)/m.exec(part);
    out[id] = cond ? cond[1].replace(/\s+/g, ' ').trim() : '';
  }
  return out;
}

/** Нарушения для одного воркфлоу с деплоем; пусто — всё в порядке. */
export function deployViolations(text: string, ciName: string): string[] {
  const bad: string[] = [];
  const triggers = triggerBlocks(text);
  const events = Object.keys(triggers);
  for (const e of events) {
    if (!SAFE_EVENTS.includes(e)) {
      bad.push(
        `триггер «${e}» запрещён: деплой идёт только по workflow_run после CI или вручную`,
      );
    }
  }
  const conds = jobConditions(text);
  const run = triggers.workflow_run;
  if (run !== undefined) {
    const named = new RegExp(`(^|[\\s\\[,'"-])${ciName}($|[\\s\\],'"])`, 'm');
    if (!/workflows:/.test(run) || !named.test(run)) {
      bad.push(`workflow_run должен слушать воркфлоу «${ciName}»`);
    }
    if (!/types:.*completed/.test(run)) {
      bad.push('workflow_run должен ловить types: [completed]');
    }
    for (const [job, cond] of Object.entries(conds)) {
      if (!/workflow_run\.conclusion\s*==\s*'success'/.test(cond)) {
        bad.push(`у джобы «${job}» нет условия conclusion == 'success'`);
      }
      if (!/workflow_run\.head_branch\s*==\s*'main'/.test(cond)) {
        bad.push(`у джобы «${job}» нет условия head_branch == 'main'`);
      }
      if (!/workflow_run\.event\s*==\s*'push'/.test(cond)) {
        bad.push(
          `у джобы «${job}» нет условия event == 'push' (head_branch == main есть и у PR из форка)`,
        );
      }
    }
    for (const l of stripComments(text).split('\n')) {
      if (
        /github\.sha|GITHUB_SHA/.test(l) &&
        !/workflow_run\.head_sha/.test(l)
      ) {
        bad.push(
          `«${l.trim()}»: у workflow_run github.sha — не проверенный коммит, нужен head_sha`,
        );
      }
    }
  }
  if (run === undefined || 'workflow_dispatch' in triggers) {
    for (const [job, cond] of Object.entries(conds)) {
      if (!/github\.ref\s*==\s*'refs\/heads\/main'/.test(cond)) {
        bad.push(`у джобы «${job}» нет защиты ручного запуска ref == main`);
      }
    }
  }
  return bad;
}
