// Правила гейта «деплой ждёт CI» (аудит 2026-10, quality#35). Чистые функции
// над текстом воркфлоу; сам разбор текста (`on:`, джобы, комментарии) — в
// workflow-yaml.ts, общий с соседними гейтами. Прогон по настоящим файлам и
// контрольные образцы — deploy-needs-ci.spec.ts.
//
// Что гейт считает деплоем: ssh/scp, ops.sh, ssh-setup.sh и сторонние
// ssh-экшены (`uses: …ssh…`). Чего НЕ видит: `docker push` прямо в боевой
// реестр без захода на сервер и деплой через экшен, в имени которого нет
// «ssh». Новый способ доставки на сервер добавляется в DEPLOY_MARKS в том же
// PR, иначе воркфлоу с ним останется вне гейта молча.

import { jobBlocks, stripComments, triggerBlocks } from './workflow-yaml';

const DEPLOY_MARKS =
  /\b(?:ops\.sh|ssh-setup\.sh|scp|ssh vps)\b|uses:\s*\S*ssh/i;
/** Единственные триггеры воркфлоу, который ходит на боевой сервер. */
const SAFE_EVENTS = ['workflow_run', 'workflow_dispatch'];

/** Воркфлоу ходит на сервер: ssh/scp или фиксированные операции ops.sh. */
export const isDeployWorkflow = (text: string): boolean =>
  DEPLOY_MARKS.test(stripComments(text));

/** Job-level `if:` каждой джобы (многострочный `>-` склеивается). */
export function jobConditions(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, part] of Object.entries(jobBlocks(text))) {
    const cond = /^ {4}if:[ \t]*(.*(?:\n {5,}.*)*)/m.exec(part);
    out[id] = cond ? cond[1].replace(/\s+/g, ' ').trim() : '';
  }
  return out;
}

/** Шаги воркфлоу: текст каждого `- …` на отступе шести пробелов. */
export function steps(text: string): string[] {
  const out: string[] = [];
  for (const l of stripComments(text).split('\n')) {
    if (/^ {6}- /.test(l)) out.push(l);
    else if (out.length && /^ {7,}/.test(l)) out[out.length - 1] += '\n' + l;
  }
  return out;
}

/**
 * В workflow_run-деплое checkout без `ref:` берёт github.sha (HEAD main), а
 * не коммит, который проверил CI; сборка образа без `context:` берёт git-контекст
 * того же github.sha. Оба случая молча обходят привязку к head_sha.
 */
function pinnedShaViolations(text: string): string[] {
  const bad: string[] = [];
  for (const step of steps(text)) {
    if (/uses:\s*actions\/checkout/.test(step)) {
      const ref = /^\s+ref:\s*(.*)$/m.exec(step)?.[1] ?? '';
      if (!/workflow_run\.head_sha|DEPLOY_SHA/.test(ref)) {
        bad.push(
          'actions/checkout без ref: head_sha/DEPLOY_SHA берёт HEAD main, а не коммит, проверенный CI',
        );
      }
    }
    if (/uses:\s*docker\/build-push-action/.test(step)) {
      const ctx = /^\s+context:\s*(.*)$/m.exec(step)?.[1].trim() ?? '';
      if (!ctx || /^(?:git|https?):|^\$\{\{/.test(ctx)) {
        bad.push(
          'docker/build-push-action без локального context: собирает git-контекст github.sha, а не checkout головы CI',
        );
      }
    }
  }
  return bad;
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
  if (run !== undefined) bad.push(...pinnedShaViolations(text));
  if (run === undefined || 'workflow_dispatch' in triggers) {
    for (const [job, cond] of Object.entries(conds)) {
      if (!/github\.ref\s*==\s*'refs\/heads\/main'/.test(cond)) {
        bad.push(`у джобы «${job}» нет защиты ручного запуска ref == main`);
      }
    }
  }
  return bad;
}
