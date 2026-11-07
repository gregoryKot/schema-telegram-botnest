// scripts/branch-cleanup.mjs — чистка веток смерженных PR (не гейт, но
// удаляет ветки в живом репозитории). Скрипт исполняется по-настоящему против
// локального сервера, изображающего GitHub API: какие ветки он удаляет, а какие
// обязан оставить. Контрольные образцы: PR из форка с тем же именем ветки,
// голова, сдвинувшаяся между планом и удалением, ветка по умолчанию.
import { spawn } from 'child_process';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';

const SCRIPT = join(process.cwd(), 'scripts', 'branch-cleanup.mjs');
const REPO = 'o/r';

type Pr = {
  number: number;
  state: string;
  merged_at: string | null;
  head: { ref: string; sha: string; repo: { full_name: string } };
};
const pr = (number: number, ref: string, sha: string, how: string): Pr => ({
  number,
  state: how === 'open' ? 'open' : 'closed',
  merged_at: how === 'merged' ? '2026-11-01T00:00:00Z' : null,
  head: { ref, sha, repo: { full_name: REPO } },
});

const filler = Array.from({ length: 120 }, (_, i) => [`old-${i}`, `f${i}`]);
const BRANCHES: [string, string][] = [
  ['main', 'm'],
  ...(filler as [string, string][]), // первые 100 — страница 1, дальше — 2
  ['merged-clean', 'a'],
  ['merged-pushed', 'b2'],
  ['open-pr', 'c'],
  ['closed', 'd'],
  ['fork', 'f'],
  ['claude/slash-name', 'g'],
  ['moved', 'h'],
];
const PULLS: Pr[] = [
  pr(1, 'merged-clean', 'a', 'merged'),
  pr(2, 'merged-pushed', 'b1', 'merged'),
  pr(3, 'open-pr', 'c', 'open'),
  pr(4, 'open-pr', 'c', 'merged'),
  pr(5, 'closed', 'd', 'closed'),
  {
    ...pr(6, 'fork', 'f', 'merged'),
    head: { ref: 'fork', sha: 'f', repo: { full_name: 'x/r' } },
  },
  pr(7, 'claude/slash-name', 'g', 'merged'),
  pr(8, 'moved', 'h', 'merged'),
];

let server: Server;
let base = '';
const deleted: string[] = [];

function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://x');
  const send = (code: number, body?: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const page = <T>(all: T[]) => {
    const n = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get('per_page') ?? 30);
    return all.slice((n - 1) * size, n * size);
  };
  const p = decodeURIComponent(url.pathname);
  if (
    req.method === 'DELETE' &&
    p.startsWith(`/repos/${REPO}/git/refs/heads/`)
  ) {
    deleted.push(p.slice(`/repos/${REPO}/git/refs/heads/`.length));
    return send(204);
  }
  if (p === `/repos/${REPO}`) return send(200, { default_branch: 'main' });
  if (p === `/repos/${REPO}/pulls`) return send(200, page(PULLS));
  if (p === `/repos/${REPO}/branches`)
    return send(
      200,
      page(BRANCHES.map(([name, sha]) => ({ name, commit: { sha } }))),
    );
  const name = p.slice(`/repos/${REPO}/branches/`.length);
  const hit = BRANCHES.find(([n]) => n === name);
  if (!hit) return send(404, { message: 'Not Found' });
  const sha = name === 'moved' ? 'h-new' : hit[1]; // кто-то запушил после плана
  return send(200, { name, commit: { sha } });
}

function run(args: string[], env: Record<string, string> = {}) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, '--delay-ms=0', ...args], {
      env: {
        PATH: process.env.PATH ?? '',
        GITHUB_API_URL: base,
        GITHUB_REPOSITORY: REPO,
        GITHUB_TOKEN: 't',
        ...env,
      },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

beforeAll(async () => {
  server = createServer(handle);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => (deleted.length = 0));

describe('branch-cleanup.mjs', () => {
  it('без --apply только печатает план и ничего не удаляет', async () => {
    const { code, out } = await run([]);
    expect(code).toBe(0);
    expect(deleted).toEqual([]);
    expect(out).toContain('к удалению: 3');
    expect(out).toContain('к удалению: merged-clean (PR #1)');
    expect(out).toContain('к удалению: claude/slash-name (PR #7)');
    expect(out).toContain('Только список');
  });

  it('--apply удаляет только ветки смерженных PR без новых коммитов', async () => {
    const { code, out } = await run(['--apply']);
    expect(code).toBe(0);
    expect(deleted.sort()).toEqual(['claude/slash-name', 'merged-clean']);
    expect(out).toContain('пропуск: moved — голова сдвинулась');
    expect(out).toContain('Удалено веток: 2 из 3');
  });

  it('оставляет: открытый PR, коммиты после мержа, закрытый без мержа, без PR, PR из форка, main', async () => {
    const { out } = await run([]);
    expect(out).toMatch(/открытый PR \(1\): open-pr/);
    expect(out).toMatch(/коммиты после мержа \(1\): merged-pushed/);
    expect(out).toMatch(/закрыт без мержа \(1\): closed/);
    expect(out).toMatch(/PR нет \(121\): old-0, .*fork/);
    expect(out).not.toMatch(/к удалению: main\b/);
  });

  it('без токена — красный выход с ::error::, ничего не трогает', async () => {
    const { code, out } = await run(['--apply'], { GITHUB_TOKEN: '' });
    expect(code).toBe(1);
    expect(out).toContain('::error::branch-cleanup');
    expect(deleted).toEqual([]);
  });
});
