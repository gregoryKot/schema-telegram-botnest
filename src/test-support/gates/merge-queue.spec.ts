// scripts/merge-queue.mjs — очередь мержа (не гейт, но пишет в живой
// репозиторий): скрипт исполняется по-настоящему против локального сервера,
// изображающего GitHub API. Обязательные проверки — из записанного ответа
// /rules/branches/main. Плюс форма .github/workflows/merge-queue.yml: у джобы
// запись, поэтому событий PR и чекаута кода PR нет.
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';
import { importExport } from './pattern-loader';
import { stripComments, triggerBlocks } from './workflow-yaml';

const ROOT = process.cwd();
const SCRIPT = join(ROOT, 'scripts', 'merge-queue.mjs');
const REPO = 'o/r';
const BOT = 'github-actions[bot]';
const CI = '.github/workflows/ci.yml';
const AUTOMERGE = '.github/workflows/dependabot-automerge.yml';
const RULES: unknown[] = JSON.parse(
  readFileSync(
    join(ROOT, 'test/fixtures/recorded/github-rules-branch-main.json'),
    'utf8',
  ),
);
const CONTEXTS = (
  RULES as {
    type: string;
    parameters?: { required_status_checks?: { context: string }[] };
  }[]
)
  .filter((r) => r.type === 'required_status_checks')
  .flatMap((r) => r.parameters?.required_status_checks ?? [])
  .map((c) => c.context);

type CheckRun = Record<string, unknown>;
type WfRun = Record<string, unknown>;
type Pr = {
  n: number;
  behind: number;
  checks: CheckRun[];
  author?: string;
  draft?: boolean;
  auto?: boolean;
  label?: string;
  fork?: boolean;
  /** HTTP-ответ update-branch; по умолчанию 202. */
  update?: number;
  /** false — голова после update-branch не меняется. */
  moves?: boolean;
  sha?: string;
};

// Сколько очередь ждёт мержа свежего зелёного PR — из самого модуля правил.
const GRACE_MS = Number(
  importExport('merge-queue-plan.mjs', 'GREEN_GRACE_MS', '(v) => v'),
);
let seq = 1;
const OLD = new Date(Date.now() - GRACE_MS - 60_000).toISOString();
const checks = (conclusion: string, at = OLD): CheckRun[] =>
  CONTEXTS.map((name) => ({
    id: seq++,
    name,
    app: { id: 15368 },
    status: 'completed',
    conclusion,
    completed_at: at,
  }));
/** Все зелёные, кроме первой обязательной (`backend`). */
const oneOff = (patch: CheckRun): CheckRun[] => [
  ...checks('success').slice(1),
  { ...checks('success')[0], ...patch },
];
const GREEN = checks('success');
const RED = oneOff({ conclusion: 'failure' });
const PENDING = oneOff({ status: 'in_progress', conclusion: null });
const CANCELLED = oneOff({ conclusion: 'cancelled' });
const wf = (path: string, actor = BOT, repo = REPO): WfRun => ({
  id: seq++,
  path,
  event: 'pull_request',
  status: 'completed',
  conclusion: 'action_required',
  head_repository: { full_name: repo },
  triggering_actor: { login: actor },
});

let pulls: Pr[] = [];
let rules: unknown[] = RULES;
let runs: Record<string, WfRun[]> = {};
let comments: Record<number, unknown[]> = {};
let writes: string[] = [];
let server: Server;
let base = '';

function setup(prs: Pr[], more: { runs?: typeof runs } = {}): void {
  pulls = prs.map((p) => ({ ...p, sha: `sha-${p.n}` }));
  rules = RULES;
  runs = more.runs ?? {};
  comments = {};
  writes = [];
}

function afterUpdate(p: Pr): void {
  if (p.moves === false) return;
  p.sha = `${p.sha}-up`;
  runs[p.sha] = [
    wf(CI),
    wf(AUTOMERGE),
    wf(CI, 'someone'), // не очередь
    wf(CI, BOT, 'x/r'), // форк
  ];
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  let raw = '';
  req.on('data', (d) => (raw += d));
  req.on('end', () => {
    const url = new URL(req.url ?? '/', 'http://x');
    const p = decodeURIComponent(url.pathname).replace(`/repos/${REPO}`, '');
    const send = (code: number, body?: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    const pr = (n: string | number) => pulls.find((x) => x.n === Number(n))!;
    const bySha = (sha: string) => pulls.find((x) => x.sha === sha)!;
    let m: RegExpMatchArray | null;
    if (req.method !== 'GET') writes.push(`${req.method} ${p} ${raw}`.trim());
    if (p === '/rules/branches/main') return send(200, rules);
    if (p === '/pulls')
      return send(
        200,
        pulls.map((x) => ({
          number: x.n,
          draft: !!x.draft,
          auto_merge: x.auto === false ? null : { merge_method: 'squash' },
          base: { ref: 'main' },
          head: { sha: x.sha, repo: { full_name: x.fork ? 'x/r' : REPO } },
          labels: x.label ? [{ name: x.label }] : [],
          user: { login: x.author ?? 'gregoryKot' },
        })),
      );
    if ((m = p.match(/^\/compare\/main\.\.\.(.+)$/)))
      return send(200, { behind_by: bySha(m[1]).behind });
    if ((m = p.match(/^\/commits\/(.+)\/check-runs$/)))
      return send(200, { check_runs: bySha(m[1]).checks });
    if (p.startsWith('/commits/'))
      return send(200, { commit: { committer: { date: OLD } } });
    if (p === '/actions/runs')
      return send(200, {
        workflow_runs: runs[url.searchParams.get('head_sha') ?? ''] ?? [],
      });
    if ((m = p.match(/^\/actions\/runs\/(\d+)\/approve$/))) {
      for (const list of Object.values(runs))
        for (const r of list)
          if (r.id === Number(m[1])) Object.assign(r, { conclusion: null });
      return send(201, {});
    }
    if ((m = p.match(/^\/pulls\/(\d+)\/update-branch$/))) {
      const x = pr(m[1]);
      const code = x.update ?? 202;
      if (code === 202) afterUpdate(x);
      return send(code, { message: 'm' });
    }
    if ((m = p.match(/^\/pulls\/(\d+)$/)))
      return send(200, { head: { sha: pr(m[1]).sha } });
    if ((m = p.match(/^\/issues\/(\d+)\/comments$/)))
      return req.method === 'GET'
        ? send(200, comments[Number(m[1])] ?? [])
        : send(201, {});
    return send(404, { message: `нет заготовки: ${p}` });
  });
}

function run(args: string[] = []) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      env: {
        PATH: process.env.PATH ?? '',
        GITHUB_API_URL: base,
        GITHUB_REPOSITORY: REPO,
        GITHUB_TOKEN: 't',
        MERGE_QUEUE_POLL_MS: '0',
      },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

const updated = () =>
  writes
    .filter((w) => w.startsWith('PUT'))
    .map((w) => Number(/pulls\/(\d+)/.exec(w)?.[1]));
const approved = () =>
  writes
    .filter((w) => w.includes('/approve'))
    .map((w) => Number(/runs\/(\d+)/.exec(w)?.[1]));
const idsOf = (sha: string, ...picks: number[]) =>
  picks.map((i) => runs[sha][i].id);

beforeAll(async () => {
  server = createServer(handle);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('merge-queue.mjs: один PR за раз', () => {
  it('подтягивает самого старого годного и одобряет только прогоны очереди', async () => {
    setup([
      { n: 13, behind: 1, checks: GREEN },
      { n: 5, behind: 3, checks: GREEN, draft: true },
      { n: 6, behind: 3, checks: GREEN, auto: false },
      { n: 7, behind: 3, checks: GREEN, label: 'do-not-merge' },
      { n: 8, behind: 3, checks: GREEN, fork: true },
      { n: 9, behind: 3, checks: RED },
      { n: 10, behind: 3, checks: [] },
      { n: 11, behind: 2, checks: CANCELLED },
      { n: 12, behind: 1, checks: PENDING },
    ]);
    const { code, out } = await run();
    expect(code).toBe(0);
    expect(updated()).toEqual([12]);
    expect(writes[0]).toContain('"expected_head_sha":"sha-12"');
    expect(approved()).toEqual(idsOf('sha-12-up', 0, 1));
    expect(out).toContain('#9: отстаёт на 3, обязательные проверки — red');
    expect(out).toContain('#11: отстаёт на 2, обязательные проверки — missing');
    expect(out).toContain(
      'подтянут (sha-12 → sha-12-up), одобрено прогонов: 2',
    );
  });

  it('перезапуск зелёный после красного — не красный', async () => {
    // id у перезапуска больше: он и есть последний прогон проверки.
    setup([{ n: 4, behind: 1, checks: [...RED, ...checks('success')] }]);
    await run();
    expect(updated()).toEqual([4]);
  });

  it('свежий PR с идущими проверками «в работе» — остальных не трогает', async () => {
    setup([
      { n: 3, behind: 0, checks: PENDING },
      { n: 4, behind: 2, checks: GREEN },
    ]);
    const { out } = await run();
    expect(writes).toEqual([]);
    expect(out).toContain('#3 в работе');
  });

  it('только что позеленевший свежий ждёт мержа, зависший дольше GREEN_GRACE_MS очередь не держит', async () => {
    const now = checks('success', new Date().toISOString());
    setup([
      { n: 3, behind: 0, checks: now },
      { n: 4, behind: 1, checks: GREEN },
    ]);
    await run();
    expect(writes).toEqual([]);
    setup([
      { n: 3, behind: 0, checks: GREEN },
      { n: 4, behind: 1, checks: GREEN },
    ]);
    await run();
    expect(updated()).toEqual([4]);
  });

  it('конфликт (422) — пропуск к следующему', async () => {
    setup([
      { n: 4, behind: 1, checks: GREEN, update: 422 },
      { n: 5, behind: 1, checks: GREEN },
    ]);
    const { out } = await run();
    expect(updated()).toEqual([4, 5]);
    expect(out).toContain('#4: update-branch отказал (422');
  });

  it('иной отказ: бот-PR просит пересборку раз на голову, PR агента — предупреждение', async () => {
    const prs = (author?: string): Pr[] => [
      { n: 4, behind: 1, checks: GREEN, update: 403, author },
      { n: 5, behind: 1, checks: GREEN },
    ];
    setup(prs('dependabot[bot]'));
    await run();
    expect(writes[writes.length - 1]).toContain('POST /issues/4/comments');
    expect(writes[writes.length - 1]).toContain('@dependabot recreate');
    expect(updated()).toEqual([4]);

    setup(prs('dependabot[bot]'));
    const later = new Date(Date.parse(OLD) + 1000).toISOString();
    comments[4] = [
      { user: { login: BOT }, body: '@dependabot recreate', created_at: later },
    ];
    await run();
    expect(updated()).toEqual([4, 5]);
    expect(writes.some((w) => w.includes('comments'))).toBe(false);

    setup(prs());
    const { out } = await run();
    expect(out).toContain('::warning::#4: update-branch HTTP 403');
    expect(updated()).toEqual([4, 5]);
  });

  it('свежий PR без прогона: одобряет прогон очереди и ждёт его, чужой и форковый — нет', async () => {
    const mine = [wf(CI), wf(CI, 'someone'), wf(CI, BOT, 'x/r')];
    setup(
      [
        { n: 3, behind: 0, checks: [] },
        { n: 4, behind: 1, checks: GREEN },
      ],
      { runs: { 'sha-3': mine } },
    );
    await run();
    expect(approved()).toEqual([mine[0].id]);
    expect(updated()).toEqual([]);

    setup(
      [
        { n: 3, behind: 0, checks: [] },
        { n: 4, behind: 1, checks: GREEN },
      ],
      { runs: { 'sha-3': [wf(CI, 'someone')] } },
    );
    await run();
    expect(approved()).toEqual(idsOf('sha-4-up', 0, 1));
    expect(updated()).toEqual([4]);
  });

  it('--dry-run ничего не пишет', async () => {
    setup([{ n: 4, behind: 1, checks: GREEN }]);
    const { out } = await run(['--dry-run']);
    expect(writes).toEqual([]);
    expect(out).toContain('dry-run: подтянул бы #4');
  });

  it('голова не сменилась — красный выход', async () => {
    setup([{ n: 4, behind: 1, checks: GREEN, moves: false }]);
    const { code, out } = await run();
    expect(code).toBe(1);
    expect(out).toContain('::error::merge-queue: #4: голова не сменилась');
  });

  it('в ruleset нет обязательных проверок — красный выход, ничего не трогает', async () => {
    setup([{ n: 4, behind: 1, checks: GREEN }]);
    rules = [];
    const { code } = await run();
    expect(code).toBe(1);
    expect(writes).toEqual([]);
  });
});

describe('merge-queue.yml: запись есть, кода PR нет', () => {
  const real = readFileSync(
    join(ROOT, '.github', 'workflows', 'merge-queue.yml'),
    'utf8',
  );
  const violations = (text: string): string[] => {
    const on = triggerBlocks(text);
    const bad = ['pull_request', 'pull_request_target']
      .filter((e) => e in on)
      .map((e) => `слушает ${e}`);
    const body = stripComments(text);
    if (/^\s+ref:/m.test(body)) bad.push('чекаут с ref: — код не main');
    if (!body.includes('node scripts/merge-queue.mjs'))
      bad.push('не тот скрипт');
    return bad;
  };

  it('настоящий воркфлоу: push, CI, расписание и dispatch; чекаут main', () => {
    expect(Object.keys(triggerBlocks(real))).toEqual([
      'push',
      'workflow_run',
      'schedule',
      'workflow_dispatch',
    ]);
    expect(violations(real)).toEqual([]);
  });

  it('красный: события PR и чекаут головы PR', () => {
    const loose = real
      .replace(
        '  workflow_dispatch:',
        '  pull_request:\n  pull_request_target:\n  workflow_dispatch:',
      )
      .replace(
        '          persist-credentials: false',
        '          persist-credentials: false\n          ref: ${{ github.event.workflow_run.head_sha }}',
      );
    expect(violations(loose)).toEqual([
      'слушает pull_request',
      'слушает pull_request_target',
      'чекаут с ref: — код не main',
    ]);
  });
});
