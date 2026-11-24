// Поезд очереди мержа (scripts/merge-train*.mjs): движок исполняется
// по-настоящему — против локального сервера, изображающего GitHub API, и
// настоящего git-клона с драйверами сведения. Правила — чистые функции
// merge-train-plan.mjs. Каждое решение — оба исхода.
import { execFileSync, spawn } from 'child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { importExport } from './pattern-loader';

const ROOT = process.cwd();
const REPO = 'o/r';
const BOT = 'github-actions[bot]';
const CI = '.github/workflows/ci.yml';
const SIZES = 'scripts/file-size-baseline.json';
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

type Json = Record<string, unknown>;
type Pull = {
  n: number;
  sha: string;
  ref: string;
  behind: number;
  checks: Json[];
  login?: string;
  auto?: boolean;
  labels?: string[];
  body?: string;
  title?: string;
  state?: string;
  merged?: boolean;
  created?: string;
};

let seq = 1;
const HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();
const checks = (conclusion: string, at = HOUR_AGO): Json[] =>
  CONTEXTS.map((name) => ({
    id: seq++,
    name,
    app: { id: 15368 },
    status: 'completed',
    conclusion,
    completed_at: at,
  }));
const pending = (): Json[] => [
  ...checks('success').slice(1),
  {
    ...checks('success')[0],
    status: 'in_progress',
    conclusion: null,
    started_at: new Date().toISOString(),
  },
];
const red = (): Json[] => [
  ...checks('success').slice(1),
  { ...checks('failure')[0], id: 9001 },
];

/** Вызов чистой функции правил в настоящем модуле. */
const rule = <T>(name: string, ...args: unknown[]): T =>
  JSON.parse(
    importExport(
      'merge-train-plan.mjs',
      name,
      `(fn) => fn(...${JSON.stringify(args)}) ?? null`,
    ),
  ) as T;

let pulls: Pull[] = [];
let runs: Record<string, Json[]> = {};
let files: Record<number, string[]> = {};
let notes: Record<number, Json[]> = {};
let writes: string[] = [];
let createStatus = 201;
let gqlFail = 0;
let server: Server;
let base = '';
let tmp = '';
let origin = '';
let clone = '';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const show = (ref: string, file: string) =>
  git(origin, 'show', `${ref}:${file}`);
const sizes = (extra: Record<string, number> = {}) =>
  JSON.stringify({ 'a.ts': 1, ...extra, 'z.ts': 1 }, null, 2) + '\n';

/** origin: main ушёл вперёд на коммит; ветка b-N правит свой файл и свой ключ бейслайна. */
function repo(branches: Record<number, Record<string, string>>): void {
  origin = join(tmp, 'origin.git');
  clone = join(tmp, 'clone');
  const seed = join(tmp, 'seed');
  const commit = (tree: Record<string, string>, msg: string) => {
    for (const [name, text] of Object.entries(tree)) {
      mkdirSync(dirname(join(seed, name)), { recursive: true });
      writeFileSync(join(seed, name), text);
    }
    git(seed, 'add', '-A');
    git(seed, 'commit', '-q', '-m', msg);
  };
  git(tmp, 'init', '-q', '--bare', '-b', 'main', origin);
  git(tmp, 'clone', '-q', origin, seed);
  git(seed, 'checkout', '-q', '-b', 'main');
  commit({ [SIZES]: sizes(), 'x.ts': 'x\n', 'y.ts': 'y\n' }, 'база');
  git(seed, 'push', '-q', 'origin', 'main');
  for (const [n, tree] of Object.entries(branches)) {
    git(seed, 'checkout', '-q', '-b', `b-${n}`, 'main');
    commit(
      {
        [`f${n}.ts`]: `${n}\n`,
        [SIZES]: sizes({ [`f${n}.ts`]: Number(n) }),
        ...tree,
      },
      `ветка ${n}`,
    );
    git(seed, 'push', '-q', 'origin', `b-${n}`);
  }
  git(seed, 'checkout', '-q', 'main');
  commit({ 'x.ts': 'main\n' }, 'main ушёл');
  git(seed, 'push', '-q', 'origin', 'main');
  git(tmp, 'clone', '-q', origin, clone);
}

/** Зелёный отставший PR с auto-merge на ветке b-N. */
const car = (n: number, more: Partial<Pull> = {}): Pull => ({
  n,
  ref: `b-${n}`,
  sha: origin ? git(origin, 'rev-parse', `b-${n}`) : `sha-${n}`,
  behind: 1,
  checks: checks('success'),
  title: `Дело ${n}`,
  ...more,
});
const mark = (...cars: Pull[]) =>
  `<!-- merge-train: ${cars.map((c) => `${c.n}@${c.sha}`).join(' ')} -->`;
/** Открытый поезд #50 из пассажиров (их auto-merge уже снят). */
function train(cars: Pull[], more: Partial<Pull> = {}): Pull {
  for (const c of cars) c.auto = false;
  return {
    n: 50,
    ref: 'merge-train/t',
    sha: 'sha-50',
    login: BOT,
    auto: false,
    behind: 0,
    checks: pending(),
    body: mark(...cars),
    ...more,
  };
}

function setup(list: Pull[]): void {
  pulls = list;
  runs = {};
  files = {};
  notes = {};
  writes = [];
  createStatus = 201;
  gqlFail = 0;
}

const raw = (x: Pull) => ({
  number: x.n,
  node_id: `node-${x.n}`,
  title: x.title ?? `PR ${x.n}`,
  body: x.body ?? '',
  state: x.state ?? 'open',
  draft: false,
  auto_merge: x.auto === false ? null : { merge_method: 'squash' },
  merged_at: x.merged ? HOUR_AGO : null,
  created_at: x.created ?? new Date().toISOString(),
  base: { ref: 'main' },
  head: { sha: x.sha, ref: x.ref, repo: { full_name: REPO } },
  labels: (x.labels ?? []).map((name) => ({ name })),
  user: { login: x.login ?? 'gregoryKot' },
});

function handle(req: IncomingMessage, res: ServerResponse): void {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    const url = new URL(req.url ?? '/', 'http://x');
    const p = decodeURIComponent(url.pathname).replace(`/repos/${REPO}`, '');
    const send = (code: number, data?: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(data === undefined ? '' : JSON.stringify(data));
    };
    const pr = (n: string | number) => pulls.find((x) => x.n === Number(n))!;
    const get = req.method === 'GET';
    let m: RegExpMatchArray | null;
    if (!get) writes.push(`${req.method} ${p} ${body}`.trim());
    if (p === '/rules/branches/main') return send(200, RULES);
    if (p === '/pulls' && get) {
      const state = url.searchParams.get('state');
      return send(
        200,
        pulls.filter((x) => (x.state ?? 'open') === state).map(raw),
      );
    }
    if (p === '/pulls') {
      if (createStatus !== 201)
        return send(createStatus, { message: 'нельзя' });
      const made = JSON.parse(body) as {
        head: string;
        body: string;
        title: string;
      };
      const sha = git(origin, 'rev-parse', made.head);
      pulls.push({
        n: 77,
        ref: made.head,
        sha,
        login: BOT,
        auto: false,
        behind: 0,
        checks: [],
        body: made.body,
        title: made.title,
      });
      runs[sha] = [
        {
          id: 700,
          path: CI,
          event: 'pull_request',
          conclusion: 'action_required',
          head_repository: { full_name: REPO },
          triggering_actor: { login: BOT },
        },
      ];
      return send(201, { number: 77 });
    }
    if (p === '/graphql') {
      const q = JSON.parse(body) as {
        query: string;
        variables: { id: string };
      };
      const target = pr(q.variables.id.replace('node-', ''));
      if (target.n === gqlFail)
        return send(200, { errors: [{ message: 'нельзя' }] });
      target.auto = q.query.includes('enablePullRequestAutoMerge');
      return send(200, { data: {} });
    }
    if ((m = p.match(/^\/compare\/main\.\.\.(.+)$/)))
      return send(200, {
        behind_by: pulls.find((x) => x.sha === m![1])!.behind,
      });
    if ((m = p.match(/^\/commits\/(.+)\/check-runs$/)))
      return send(200, {
        check_runs: pulls.find((x) => x.sha === m![1])!.checks,
      });
    if ((m = p.match(/^\/check-runs\/(\d+)\/annotations$/)))
      return send(200, notes[Number(m[1])] ?? []);
    if (p === '/actions/runs')
      return send(200, {
        workflow_runs: runs[url.searchParams.get('head_sha') ?? ''] ?? [],
      });
    if (/^\/actions\/(runs\/\d+\/approve|workflows\/.+\/dispatches)$/.test(p))
      return send(201, {});
    if ((m = p.match(/^\/pulls\/(\d+)\/files$/)))
      return send(
        200,
        (files[Number(m[1])] ?? []).map((filename) => ({ filename })),
      );
    if ((m = p.match(/^\/pulls\/(\d+)\/update-branch$/)))
      return send(422, { message: 'конфликт' });
    if ((m = p.match(/^\/pulls\/(\d+)\/merge$/)))
      return send(200, { merged: (pr(m[1]).merged = true) });
    if ((m = p.match(/^\/pulls\/(\d+)$/))) {
      if (!get) pr(m[1]).state = 'closed';
      return send(200, raw(pr(m[1])));
    }
    if (
      /^\/issues\/\d+\/(labels|comments)/.test(p) ||
      p.startsWith('/git/refs/')
    )
      return send(get ? 200 : 201, []);
    return send(404, { message: `нет заготовки: ${p}` });
  });
}

function run(script: string, env: Record<string, string> = {}) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(
      process.execPath,
      [join(ROOT, 'scripts', script), ...(env.ARGS ? [env.ARGS] : [])],
      {
        env: {
          PATH: process.env.PATH ?? '',
          GITHUB_API_URL: base,
          GITHUB_REPOSITORY: REPO,
          GITHUB_TOKEN: 't',
          MERGE_QUEUE_POLL_MS: '0',
          MERGE_QUEUE_GIT_DIR: clone,
          MERGE_TRAIN: 'on',
          GITHUB_OUTPUT: join(tmp, 'output'),
          ...env,
        },
      },
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}
const queue = (env: Record<string, string> = {}) => run('merge-queue.mjs', env);
/** Номера PR, которых коснулась запись с таким началом (`POST /issues/` и т.п.). */
const touched = (start: string, has = '') =>
  writes
    .filter((w) => w.startsWith(start) && w.includes(has))
    .map((w) => Number(/\/(?:pulls|issues)\/(\d+)/.exec(w)?.[1]));
const autoMerge = (on: boolean) =>
  writes
    .filter((w) =>
      w.includes(
        on ? 'enablePullRequestAutoMerge' : 'disablePullRequestAutoMerge',
      ),
    )
    .map((w) => Number(/node-(\d+)/.exec(w)?.[1]));
const created = () => writes.filter((w) => w.startsWith('POST /pulls ')).length;

beforeAll(async () => {
  server = createServer(handle);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  origin = '';
  clone = '';
  tmp = mkdtempSync(join(tmpdir(), 'merge-train-'));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('поезд: сборка', () => {
  it('два зелёных отставших едут одной веткой: auto-merge снят, когда состав уже записан в PR, бейслайн сведён драйвером, правка workflow — мимо', async () => {
    repo({ 1: {}, 2: {}, 3: { '.github/workflows/w.yml': 'on: push\n' } });
    setup([car(1), car(2), car(3)]);
    const { code, out } = await queue();
    expect(code).toBe(0);
    expect(out).toContain('#3: в поезд не вошёл (правит workflow)');
    expect(out).toContain('Поезд #77 собран: #1, #2');
    expect(autoMerge(false)).toEqual([1, 2]);
    const open = writes.findIndex((w) => w.startsWith('POST /pulls '));
    expect(
      writes.findIndex((w) => w.includes('disablePullRequestAutoMerge')),
    ).toBeGreaterThan(open);
    const made = pulls.find((p) => p.n === 77)!;
    expect(made.title).toBe('Поезд: #1, #2');
    expect(made.body).toContain(mark(pulls[0], pulls[1]));
    expect(JSON.parse(show(made.ref, SIZES))).toEqual({
      'a.ts': 1,
      'f1.ts': 1,
      'f2.ts': 2,
      'z.ts': 1,
    });
    expect(show(made.ref, 'x.ts')).toBe('main');
    expect(readFileSync(join(tmp, 'output'), 'utf8')).toBe(
      `train_pr=77\ntrain_ref=${made.ref}\n`,
    );
    expect(touched('PUT ')).toEqual([]);
  });

  it('выключатель: без MERGE_TRAIN=on те же PR идут по одному', async () => {
    repo({ 1: {}, 2: {} });
    setup([car(1), car(2)]);
    await queue({ MERGE_TRAIN: '' });
    expect(created()).toBe(0);
    expect(autoMerge(false)).toEqual([]);
    expect(touched('PUT ', 'update-branch')[0]).toBe(1);
  });

  it('поезда нет: один зелёный; первый по очереди в поезд не годится; первый не свёлся', async () => {
    repo({ 1: {}, 2: {}, 3: { 'x.ts': 'ветка\n' } });
    const cases: Pull[][] = [
      [car(1), car(2, { checks: pending() })],
      [car(1, { labels: ['no-train'] }), car(2), car(3)],
      [
        car(3, {
          checks: checks(
            'success',
            new Date(Date.now() - 7_200_000).toISOString(),
          ),
        }),
        car(1),
        car(2),
      ],
    ];
    for (const list of cases) {
      setup(list);
      await queue();
      expect(created()).toBe(0);
      expect(autoMerge(false)).toEqual([]);
      expect(touched('PUT ', 'update-branch')[0]).toBe(list[0].n);
    }
  });

  it('PR-поезд не открылся: ветка убрана, auto-merge не тронут, очередь идёт обычным путём', async () => {
    repo({ 1: {}, 2: {} });
    setup([car(1), car(2)]);
    createStatus = 403;
    const { code, out } = await queue();
    expect(code).toBe(0);
    expect(out).toContain('PR-поезд не открылся: HTTP 403');
    expect(autoMerge(false)).toEqual([]);
    expect(
      writes.some((w) => w.startsWith('DELETE /git/refs/heads/merge-train/')),
    ).toBe(true);
    expect(touched('PUT ', 'update-branch')[0]).toBe(1);
  });

  it('auto-merge пассажира не снялся: поезд закрыт, ветка убрана, снятое возвращено', async () => {
    repo({ 1: {}, 2: {} });
    setup([car(1), car(2)]);
    gqlFail = 2;
    const { out } = await queue();
    expect(out).toContain(
      'auto-merge #2 не снят — пассажиры идут обычным путём',
    );
    expect(touched('PATCH /pulls/')).toEqual([77]);
    expect(autoMerge(true)).toEqual([1]);
    expect(out).not.toContain('собран');
  });

  it('--dry-run поезд не собирает и ничего не пишет', async () => {
    repo({ 1: {}, 2: {} });
    setup([car(1), car(2)]);
    const { out } = await queue({ ARGS: '--dry-run' });
    expect(out).toContain('dry-run: собрал бы поезд из #1, #2');
    expect(writes).toEqual([]);
  });
});

describe('поезд: в пути и на конечной', () => {
  it('в пути: очередь ждёт только поезд и никого не подтягивает', async () => {
    const cars = [car(1), car(2)];
    setup([...cars, train(cars), car(4)]);
    const { out } = await queue();
    expect(out).toContain('#50 в полёте');
    expect(writes).toEqual([]);
  });

  it('зелёный и свежий: squash с номерами и заголовками, пассажиры закрыты комментарием, ветки убраны, очередь зовёт себя', async () => {
    const cars = [car(1), car(2)];
    setup([...cars, train(cars, { checks: checks('success') })]);
    const { out } = await queue();
    expect(out).toContain('Поезд #50 смержен: #1, #2');
    const merge = writes.find((w) => w.startsWith('PUT /pulls/50/merge'))!;
    expect(JSON.parse(merge.slice(merge.indexOf('{')))).toEqual({
      merge_method: 'squash',
      commit_title: 'Поезд: #1 Дело 1; #2 Дело 2 (#50)',
      sha: 'sha-50',
    });
    expect(touched('POST /issues/', 'Смержено в составе поезда #50.')).toEqual([
      1, 2,
    ]);
    expect(touched('PATCH /pulls/')).toEqual([1, 2]);
    expect(
      writes.filter((w) => w.startsWith('DELETE /git/refs/heads/b-')).length,
    ).toBe(2);
    expect(
      writes.some((w) =>
        w.includes('/actions/workflows/merge-queue.yml/dispatches'),
      ),
    ).toBe(true);
  });

  it('поезд смержен без нас: пассажир с той же головой закрыт, с новыми коммитами — открыт и с auto-merge', async () => {
    const cars = [car(1), car(2)];
    const t = train(cars, { state: 'closed', merged: true });
    cars[1].sha = 'sha-2-new';
    setup([...cars, t]);
    await queue({ MERGE_TRAIN: '' });
    expect(touched('PATCH /pulls/')).toEqual([1]);
    expect(autoMerge(true)).toEqual([2]);
    expect(touched('POST /issues/', 'коммиты после неё не смержены')).toEqual([
      2,
    ]);
    // Повторный прогон: auto-merge уже возвращён — второго комментария нет.
    writes = [];
    await queue({ MERGE_TRAIN: '' });
    expect(touched('POST /issues/')).toEqual([]);
  });

  it('поезд закрыт руками или прогон оборвался: пассажирам без auto-merge он возвращён, с do-not-merge — нет', async () => {
    const cars = [car(1), car(2), car(3, { labels: ['do-not-merge'] })];
    setup([...cars, train(cars, { state: 'closed' })]);
    await queue();
    expect(autoMerge(true)).toEqual([1, 2]);
    expect(touched('PATCH /pulls/')).toEqual([]);
    expect(touched('POST /issues/', 'PR не вошёл')).toEqual([1, 2]);
  });

  it('красный, виновный назван аннотацией: он выходит с меткой и auto-merge, остальные едут новым поездом', async () => {
    repo({ 1: {}, 2: {}, 3: {} });
    const cars = [car(1), car(2), car(3)];
    setup([...cars, train(cars, { checks: red() })]);
    files = { 1: ['f1.ts'], 2: ['f2.ts'], 3: ['f3.ts'] };
    notes = { 9001: [{ path: '.github' }, { path: 'f2.ts' }] };
    const { out } = await queue();
    expect(out).toContain('Поезд #50 распущен: CI красный');
    expect(touched('PATCH /pulls/')).toEqual([50]);
    expect(autoMerge(true)).toEqual([2]);
    expect(touched('POST /issues/', '"labels":["no-train"]')).toEqual([2]);
    expect(touched('POST /issues/', 'Поезд #50 красный (backend)')).toEqual([
      2,
    ]);
    expect(pulls.find((p) => p.n === 77)!.body).toContain(
      mark(cars[0], cars[2]),
    );
    expect(autoMerge(false)).toEqual([]);
  });

  it('красный без названного виновного: состав делится, красная пара распускается целиком — оба раза без метки', async () => {
    repo({ 1: {}, 2: {}, 3: {}, 4: {} });
    const cars = [car(1), car(2), car(3), car(4)];
    setup([...cars, train(cars, { checks: red() })]);
    await queue();
    expect(autoMerge(true)).toEqual([3, 4]);
    expect(touched('POST /issues/', 'no-train')).toEqual([]);
    expect(pulls.find((p) => p.n === 77)!.body).toContain(
      mark(cars[0], cars[1]),
    );

    const pair = [car(1), car(2)];
    setup([...pair, train(pair, { checks: red() })]);
    await queue();
    expect(created()).toBe(0);
    expect(autoMerge(true)).toEqual([1, 2]);
    expect(touched('POST /issues/', 'no-train')).toEqual([]);
  });

  it('main ушёл или пассажир изменился: поезд пересобран без выпавшего, тому вернули auto-merge', async () => {
    repo({ 1: {}, 2: {}, 3: {} });
    const cars = [car(1), car(2), car(3)];
    const t = train(cars);
    cars[2].sha = 'sha-3-new';
    cars[2].checks = pending();
    setup([...cars, t]);
    const { out } = await queue();
    expect(out).toContain('Поезд #50 распущен: изменился пассажир #3');
    expect(autoMerge(true)).toEqual([3]);
    expect(pulls.find((p) => p.n === 77)!.body).toContain(
      mark(cars[0], cars[1]),
    );

    const same = [car(1), car(2)];
    setup([...same, train(same, { behind: 1 })]);
    await queue();
    expect(touched('PATCH /pulls/')).toEqual([50]);
    expect(pulls.find((p) => p.n === 77)!.body).toContain(mark(...same));
    expect(autoMerge(true)).toEqual([]);
  });

  it('поезда выключили или поезд застрял: распущен, всем пассажирам вернули auto-merge', async () => {
    const stale = new Date(Date.now() - 4 * 3_600_000).toISOString();
    for (const [env, more, why] of [
      [{ MERGE_TRAIN: '' }, {}, 'поезда выключены'],
      [{}, { created: stale }, 'не доехал за три часа'],
    ] as const) {
      const cars = [car(1), car(2)];
      setup([...cars, train(cars, more)]);
      const { out } = await queue(env);
      expect(out).toContain(`Поезд #50 распущен: ${why}`);
      expect(autoMerge(true)).toEqual([1, 2]);
      expect(created()).toBe(0);
      expect(
        writes.some((w) => w === 'DELETE /git/refs/heads/merge-train/t'),
      ).toBe(true);
    }
  });
});

describe('поезд: отправление (merge-train-depart.mjs)', () => {
  const diff = (extra: Record<string, number>) => {
    const work = join(tmp, 'seed');
    git(work, 'checkout', '-q', 'b-1');
    writeFileSync(join(work, SIZES), sizes(extra));
    writeFileSync(join(work, 'y.ts'), 'взлом\n');
    const patch = execFileSync('git', ['diff'], { cwd: work });
    git(work, 'checkout', '-q', '--', '.');
    return patch.toString('base64');
  };
  const depart = (patch: string) => {
    setup([
      {
        n: 50,
        ref: 'b-1',
        sha: git(origin, 'rev-parse', 'b-1'),
        login: BOT,
        behind: 0,
        checks: [],
      },
    ]);
    pulls[0].ref = 'merge-train/t';
    git(origin, 'branch', '-f', 'merge-train/t', 'b-1');
    return run('merge-train-depart.mjs', {
      TRAIN_PR: '50',
      TRAIN_PATCH: patch,
    });
  };

  it('патч бейслайна закоммичен в ветку поезда, чужой файл из патча не взят', async () => {
    repo({ 1: {} });
    const { code, out } = await depart(diff({ 'f1.ts': 7 }));
    expect(code).toBe(0);
    expect(out).toContain('поезд отправлен');
    expect(JSON.parse(show('merge-train/t', SIZES))['f1.ts']).toBe(7);
    expect(show('merge-train/t', 'y.ts')).toBe('y');
    expect(git(origin, 'log', '-1', '--format=%s', 'merge-train/t')).toBe(
      'Поезд: бейслайны пересчитаны на сведённом дереве',
    );
  });

  it('патч, после которого бейслайн — не счётчики, в ветку не пишется; пустой патч — поезд уходит как есть', async () => {
    repo({ 1: {} });
    const before = git(origin, 'rev-parse', 'b-1');
    const bad = await depart(diff({ 'f1.ts': -1 }));
    expect(bad.out).toContain(
      'бейслайны не пересчитаны (патч портит scripts/file-size-baseline.json)',
    );
    expect(git(origin, 'rev-parse', 'merge-train/t')).toBe(before);
    const none = await depart('');
    expect(none.out).toContain('бейслайны без изменений');
    expect(none.code).toBe(0);
  });
});

describe('поезд: правила', () => {
  it('движок очереди и отправление исполняют модули поезда, а не их копии', () => {
    const src = (f: string) => readFileSync(join(ROOT, 'scripts', f), 'utf8');
    for (const [file, dep] of [
      ['merge-queue.mjs', 'merge-queue-steps.mjs'],
      ['merge-queue.mjs', 'merge-train.mjs'],
      ['merge-train.mjs', 'merge-train-api.mjs'],
      ['merge-train.mjs', 'merge-train-build.mjs'],
      ['merge-train-build.mjs', 'merge-queue-git.mjs'],
      ['merge-train-depart.mjs', 'merge-train-build.mjs'],
    ])
      expect(src(file)).toContain(`from './${dep}'`);
  });

  it('заголовок squash: с заголовками, пока влезает в 120 знаков, иначе одни номера', () => {
    expect(rule('squashTitle', cars.slice(0, 2), 9)).toBe(
      'Поезд: #1 Дело 1; #2 Дело 2 (#9)',
    );
    const long = cars.map((c) => ({
      ...c,
      title: 'Очень длинный заголовок пассажира поезда',
    }));
    expect(rule('squashTitle', long, 9)).toBe('Поезд: #1, #2, #3, #4, #5 (#9)');
  });

  it('состав читается из тела, которое пишет сам модуль; тело без строки состава — пусто', () => {
    const body = rule<string>('trainBody', cars.slice(0, 2));
    expect(rule('carsOf', body)).toEqual([
      { number: 1, sha: 's1' },
      { number: 2, sha: 's2' },
    ]);
    expect(rule('carsOf', 'просто PR')).toEqual([]);
  });

  it('пассажиров не больше пяти; бот зависимостей и PR с конфликтом в поезд не идут', () => {
    const green = { state: 'green' };
    const many = [1, 2, 3, 4, 5, 6, 7].map((number) => ({
      number,
      checks: green,
    }));
    expect(rule<unknown[]>('pickCars', many).length).toBe(5);
    const mixed = [
      { number: 1, checks: green, flagged: true },
      { number: 2, checks: green },
      { number: 3, checks: green, author: 'dependabot[bot]' },
      { number: 4, checks: green },
    ];
    expect(
      rule<{ number: number }[]>('pickCars', mixed).map((p) => p.number),
    ).toEqual([2, 4]);
  });
});
