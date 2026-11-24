// Шаги очереди мержа с сетью: одобрение прогонов очереди, просьба боту
// пересобрать PR, ожидание CI на новой голове. Правила — merge-queue-plan.mjs.
import { BOT, runsToApprove } from './merge-queue-plan.mjs';
import { CONFLICT_LABEL } from './merge-queue-conflict.mjs';

const POLLS = 18;
const CI = '.github/workflows/ci.yml';

export function queueSteps({ call, get, R, repo, pollMs }) {
  const sleep = () => new Promise((done) => setTimeout(done, pollMs));

  /** Одобряет прогоны очереди на голове; сколько одобрено. */
  const approve = async (sha) => {
    const { workflow_runs: runs } = await get(`${R}/actions/runs?head_sha=${sha}&event=pull_request`);
    const todo = runsToApprove(runs, repo);
    for (const r of todo) {
      const res = await call('POST', `${R}/actions/runs/${r.id}/approve`);
      if (!res.ok) throw new Error(`approve прогона ${r.id}: HTTP ${res.status}`);
    }
    return { ci: runs.some((r) => r.path === CI), approved: todo.length };
  };

  /** `@dependabot recreate`, не чаще раза на голову: true — попросили сейчас. */
  const recreate = async (p) => {
    const { commit } = await get(`${R}/commits/${p.sha}`);
    const since = commit.committer.date;
    const comments = await get(`${R}/issues/${p.number}/comments?since=${since}&per_page=100`);
    const asked = comments.some(
      (c) => c.user.login === BOT && c.body.startsWith('@dependabot recreate') && c.created_at > since,
    );
    if (asked) return false;
    const res = await call('POST', `${R}/issues/${p.number}/comments`, { body: '@dependabot recreate' });
    if (!res.ok) throw new Error(`комментарий в #${p.number}: HTTP ${res.status}`);
    return true;
  };

  /** Ждёт прогон CI на новой голове и одобряет его. */
  const settle = async (p, head, how) => {
    let res = { ci: false, approved: 0 };
    for (let i = 0; i < POLLS && !res.ci; i++) {
      await sleep();
      const step = await approve(head);
      res = { ci: step.ci, approved: res.approved + step.approved };
    }
    if (!res.ci) console.log(`::warning::#${p.number}: прогон CI не появился — одобрит следующий прогон очереди`);
    if (p.flagged) await call('DELETE', `${R}/issues/${p.number}/labels/${CONFLICT_LABEL}`);
    console.log(`#${p.number}: отставал на ${p.behind}, ${how} (${p.sha} → ${head}), одобрено прогонов: ${res.approved}`);
  };

  /** Голова PR после update-branch; не сменилась за POLLS шагов — прежняя. */
  const newHead = async (p) => {
    let head = p.sha;
    for (let i = 0; i < POLLS && head === p.sha; i++) {
      await sleep();
      head = (await get(`${R}/pulls/${p.number}`)).head.sha;
    }
    return head;
  };

  return { approve, recreate, settle, newHead };
}
