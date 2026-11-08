// scripts/check-live-ruleset.mjs — ночная сверка живого ruleset `main` и
// настроек слияния с копией .github/rulesets/main.json (аудит 2026-10,
// правило №13). Скрипт исполняется по-настоящему (копия в песочнице со своей
// main.json) против локального сервера, который отвечает ЗАПИСАННЫМИ ответами
// GitHub (test/fixtures/recorded/github-*.json, правило №23). Оба исхода:
// зелёный на настоящих ответах и настоящей копии, красный на каждом виде
// расхождения, которое раньше проходило молча.
import { spawn } from 'child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadRecordedFixture } from '../recorded-fixture';
import { REAL_SCRIPTS_DIR } from './gate-sandbox';

const SCRIPT = 'check-live-ruleset.mjs';
const REPO = 'o/r';
const COPY = readFileSync(
  join(REAL_SCRIPTS_DIR, '..', '.github', 'rulesets', 'main.json'),
  'utf8',
);
type Json = Record<string, unknown>;
type Rule = { type: string; parameters?: Json; ruleset_id?: number };
const recorded = <T>(name: string): T =>
  JSON.parse(loadRecordedFixture(name)) as T;

let server: Server;
let base = '';
let responses: { rulesets: unknown; rules: unknown; repo: unknown };
let status = 200;
const auth: (string | undefined)[] = [];

function handle(req: IncomingMessage, res: ServerResponse): void {
  auth.push(req.headers.authorization);
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const body =
    path === `/repos/${REPO}/rulesets`
      ? responses.rulesets
      : path === `/repos/${REPO}/rules/branches/main`
        ? responses.rules
        : path === `/repos/${REPO}`
          ? responses.repo
          : undefined;
  const code = body === undefined ? 404 : status;
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body ?? { message: 'Not Found' }));
}

function run(copy = COPY, env: Record<string, string> = {}) {
  const tmp = mkdtempSync(join(realpathSync(tmpdir()), 'live-ruleset-'));
  mkdirSync(join(tmp, 'scripts'));
  mkdirSync(join(tmp, '.github', 'rulesets'), { recursive: true });
  copyFileSync(join(REAL_SCRIPTS_DIR, SCRIPT), join(tmp, 'scripts', SCRIPT));
  writeFileSync(join(tmp, '.github', 'rulesets', 'main.json'), copy);
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(process.execPath, [join(tmp, 'scripts', SCRIPT)], {
      env: {
        PATH: process.env.PATH ?? '',
        GITHUB_API_URL: base,
        GITHUB_REPOSITORY: REPO,
        ...env,
      },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      rmSync(tmp, { recursive: true, force: true });
      resolve({ code, out });
    });
  });
}

/** Записанные правила main с правкой одного правила по типу. */
function rulesWith(type: string, edit: (r: Rule) => Rule | null): Rule[] {
  return recorded<Rule[]>('github-rules-branch-main.json')
    .map((r) => (r.type === type ? edit(r) : r))
    .filter((r): r is Rule => r !== null);
}

beforeAll(async () => {
  server = createServer(handle);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  status = 200;
  auth.length = 0;
  responses = {
    rulesets: recorded('github-rulesets.json'),
    rules: recorded('github-rules-branch-main.json'),
    repo: recorded('github-repo-merge-settings.json'),
  };
});

describe('check-live-ruleset.mjs', () => {
  it('записанные ответы GitHub + настоящая копия — exit 0', async () => {
    const r = await run();
    expect(r.out).not.toContain('::error::');
    expect(r.code).toBe(0);
    expect(r.out).toContain('✓');
  });

  it('strict снят на GitHub — красный', async () => {
    responses.rules = rulesWith('required_status_checks', (r) => ({
      ...r,
      parameters: {
        ...r.parameters,
        strict_required_status_checks_policy: false,
      },
    }));
    const r = await run();
    expect(r.code).toBe(1);
    expect(r.out).toContain(
      'strict_required_status_checks_policy на GitHub false',
    );
  });

  it('ruleset выключен: enforcement disabled и правил у main нет — красный', async () => {
    responses.rulesets = recorded<Json[]>('github-rulesets.json').map((r) => ({
      ...r,
      enforcement: 'disabled',
    }));
    responses.rules = [];
    const r = await run();
    expect(r.code).toBe(1);
    expect(r.out).toContain('enforcement на GitHub disabled, в копии active');
    expect(r.out).toContain(
      'правила non_fast_forward из копии GitHub к main не применяет',
    );
  });

  it('джоба обязательна в копии, а на GitHub её забыли — красный', async () => {
    const copy = JSON.parse(COPY) as { rules: Rule[] };
    const sc = copy.rules.find((r) => r.type === 'required_status_checks');
    (sc!.parameters!.required_status_checks as Json[]).push({
      context: 'new-job',
      integration_id: 15368,
    });
    const r = await run(JSON.stringify(copy));
    expect(r.code).toBe(1);
    expect(r.out).toContain(
      'проверка new-job обязательна в копии, но не на GitHub',
    );
  });

  it('на GitHub лишняя обязательная проверка или чужое правило — красный', async () => {
    responses.rules = [
      ...rulesWith('required_status_checks', (r) => ({
        ...r,
        parameters: {
          ...r.parameters,
          required_status_checks: [
            ...(r.parameters!.required_status_checks as Json[]),
            { context: 'ghost', integration_id: 15368 },
          ],
        },
      })),
      { type: 'required_linear_history', ruleset_id: 26764047 },
    ];
    const r = await run();
    expect(r.code).toBe(1);
    expect(r.out).toContain(
      'проверка ghost обязательна на GitHub, но не в копии',
    );
    expect(r.out).toContain(
      'правило required_linear_history, которого нет в копии',
    );
  });

  it.each(['allow_auto_merge', 'delete_branch_on_merge', 'allow_squash_merge'])(
    '%s выключен в настройках репозитория — красный',
    async (key) => {
      responses.repo = {
        ...recorded<Json>('github-repo-merge-settings.json'),
        [key]: false,
      };
      const r = await run();
      expect(r.code).toBe(1);
      expect(r.out).toContain(`${key} = false, нужно true`);
    },
  );

  it('API не отдал настройки слияния (токену не видно) — красный с причиной, не пропуск', async () => {
    const repo = recorded<Json>('github-repo-merge-settings.json');
    delete repo.allow_auto_merge;
    delete repo.delete_branch_on_merge;
    responses.repo = repo;
    const r = await run();
    expect(r.code).toBe(1);
    expect(r.out).toContain('API не отдал allow_auto_merge');
  });

  it('GitHub не ответил — красный «не удалось спросить», а не зелёный', async () => {
    status = 500;
    const r = await run();
    expect(r.code).toBe(1);
    expect(r.out).toContain('не удалось спросить GitHub');
  });

  it('GITHUB_TOKEN уходит заголовком Bearer; без него запрос без авторизации', async () => {
    await run(COPY, { GITHUB_TOKEN: 't0k' });
    expect(auth).toEqual(['Bearer t0k', 'Bearer t0k', 'Bearer t0k']);
    auth.length = 0;
    await run();
    expect(auth).toEqual([undefined, undefined, undefined]);
  });
});
