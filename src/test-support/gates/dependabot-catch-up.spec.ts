// dependabot-catch-up.yml: шаг не пересказывается, а ИСПОЛНЯЕТСЯ — `run:` из
// настоящего YAML идёт в bash с поддельным `gh` в PATH, как в
// src/infra/alarm-workflow.spec.ts. jq настоящий: разбор ответов живёт в шаге.
import { spawnSync } from 'child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { jobBody, runBlock, steps } from '../workflow-steps';

const yml = readFileSync(
  join(process.cwd(), '.github', 'workflows', 'dependabot-catch-up.yml'),
  'utf8',
);
const script = runBlock(steps(jobBody(yml, 'catch-up'))[0]);

// Поддельный gh: пишет вызов в лог и отвечает первой заготовкой, чей шаблон совпал.
const FAKE_GH = `#!/usr/bin/env node
const fs = require('fs');
const call = process.argv.slice(2).join(' ');
fs.appendFileSync(process.env.GH_LOG, call + '\\n');
const replies = JSON.parse(fs.readFileSync(process.env.GH_REPLIES, 'utf8'));
const hit = replies.find(([re]) => new RegExp(re).test(call));
if (!hit) { fs.writeSync(2, 'fake gh: нет заготовки: ' + call + '\\n'); process.exit(1); }
const { out = '', err = '', code = 0 } = hit[1];
fs.writeSync(1, out);
fs.writeSync(2, err);
process.exit(code);
`;

type Reply = { out?: string; err?: string; code?: number };
type Pr = {
  n: number;
  auto?: boolean;
  behind?: number;
  /** Итог проверки; `in_progress` — прогон ещё идёт. */
  checks?: string[];
  update?: Reply;
  comment?: Reply;
  comments?: { login: string; at: string }[];
};

const branch = (n: number) => `dependabot/npm_and_yarn/pkg-${n}`;
const json = (v: unknown): Reply => ({ out: JSON.stringify(v) });
const http = (code: number): Reply => ({
  code: 1,
  err: `gh: Something (HTTP ${code})\n`,
});
const HEAD_DATE = '2026-11-13T10:00:00Z';
const check = (c: string) =>
  c === 'in_progress'
    ? { status: c, conclusion: null }
    : { status: 'completed', conclusion: c };

function replies(prs: Pr[]): [string, Reply][] {
  const list = prs.map(({ n, auto = true }) => ({
    number: n,
    headRefName: branch(n),
    headRefOid: `old${n}`,
    autoMergeRequest: auto ? { mergeMethod: 'SQUASH' } : null,
  }));
  const perPr = prs.flatMap((pr): [string, Reply][] => [
    [`compare/main\\.\\.\\.old${pr.n}$`, json({ behind_by: pr.behind ?? 3 })],
    [
      `commits/old${pr.n}/check-runs`,
      json({ check_runs: (pr.checks ?? ['success']).map(check) }),
    ],
    [`pulls/${pr.n}/update-branch`, pr.update ?? json({ message: 'ok' })],
    [`^pr view ${pr.n} `, json({ headRefOid: `new${pr.n}` })],
    [
      `commits/old${pr.n}$`,
      json({ commit: { committer: { date: HEAD_DATE } } }),
    ],
    [
      `issues/${pr.n}/comments`,
      json(
        (pr.comments ?? []).map(({ login, at }) => ({
          user: { login },
          body: '@dependabot recreate',
          created_at: at,
        })),
      ),
    ],
    [`^pr comment ${pr.n} `, pr.comment ?? {}],
  ]);
  return [['^pr list ', json(list)], ...perPr, ['^workflow run ci\\.yml ', {}]];
}

let bin: string;
beforeAll(() => {
  bin = mkdtempSync(join(tmpdir(), 'fake-gh-'));
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
});
afterAll(() => rmSync(bin, { recursive: true, force: true }));

function run(...prs: Pr[]) {
  const log = join(bin, 'gh.log');
  const answers = join(bin, 'replies.json');
  rmSync(log, { force: true });
  writeFileSync(answers, JSON.stringify(replies(prs)));
  const r = spawnSync('bash', ['-e', '-c', script], {
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      GH_LOG: log,
      GH_REPLIES: answers,
      GH_REPO: 'o/r',
      GH_TOKEN: 'fake',
    },
    encoding: 'utf8',
  });
  const calls = existsSync(log)
    ? readFileSync(log, 'utf8').split('\n').filter(Boolean)
    : [];
  const writes = calls.filter((c) =>
    /-X PUT|^workflow run|^pr comment/.test(c),
  );
  return { status: r.status, out: `${r.stdout}${r.stderr}`, calls, writes };
}

const put = (n: number) =>
  `api -X PUT repos/o/r/pulls/${n}/update-branch -f expected_head_sha=old${n}`;
const recreate = (n: number) => `pr comment ${n} --body @dependabot recreate`;
const caughtUp = (n: number) => [
  put(n),
  `workflow run ci.yml --ref ${branch(n)}`,
];

describe('dependabot-catch-up.yml: шаг с поддельным gh', () => {
  it('зелёный отставший: update-branch по старой голове, затем ci.yml на ветке бота', () => {
    const r = run({ n: 7, checks: ['success', 'skipped', 'neutral'] });
    expect(r.status).toBe(0);
    expect(r.calls[0]).toMatch(
      /^pr list --author app\/dependabot --state open /,
    );
    expect(r.writes).toEqual(caughtUp(7));
  });

  it.each<[string, Pr, string]>([
    ['не отстаёт от main', { n: 7, behind: 0 }, 'не отстаёт'],
    ['failure на голове', { n: 7, checks: ['success', 'failure'] }, 'красные'],
    ['timed_out на голове', { n: 7, checks: ['timed_out'] }, 'красные'],
    ['проверки идут', { n: 7, checks: ['success', 'in_progress'] }, 'ещё идут'],
  ])('контроль: %s — ни одного пишущего вызова', (_l, pr, says) => {
    const r = run(pr);
    expect(r.status).toBe(0);
    expect(r.out).toContain(says);
    expect(r.writes).toEqual([]);
  });

  it('без auto-merge: PR не трогается вовсе', () => {
    const r = run({ n: 7, auto: false });
    expect(r.status).toBe(0);
    expect(r.calls).toHaveLength(1);
    expect(r.writes).toEqual([]);
  });

  it('422 от update-branch: пропуск без аварии, CI не запускается', () => {
    const r = run({ n: 7, update: http(422) });
    expect(r.status).toBe(0);
    expect(r.writes).toEqual([put(7)]);
  });

  it('отказ 403: просит бота пересобрать, без dispatch', () => {
    const r = run({ n: 7, update: http(403) });
    expect(r.status).toBe(0);
    expect(r.out).toContain('отказал (HTTP 403), попросил бота пересобрать');
    expect(r.writes).toEqual([put(7), recreate(7)]);
  });

  it('отказ 403, наш запрос новее головы — второй раз не просит', () => {
    const late = { login: 'github-actions[bot]', at: '2026-11-13T11:00:00Z' };
    const r = run({ n: 7, update: http(403), comments: [late] });
    expect(r.status).toBe(0);
    expect(r.out).toContain('уже запрошена');
    expect(r.writes).toEqual([put(7)]);
  });

  it('контроль: наш запрос старше головы, свежий — чужой: просит снова', () => {
    const comments = [
      { login: 'github-actions[bot]', at: '2026-11-13T09:00:00Z' },
      { login: 'someone', at: '2026-11-13T11:00:00Z' },
    ];
    const r = run({ n: 7, update: http(403), comments });
    expect(r.writes).toEqual([put(7), recreate(7)]);
  });

  it('сбой одного PR не валит остальные, но красит джобу', () => {
    const r = run({ n: 1, update: http(500), comment: http(500) }, { n: 2 });
    expect(r.status).toBe(1);
    expect(r.out).toContain('::error::#1');
    expect(r.writes).toEqual([put(1), recreate(1), ...caughtUp(2)]);
  });
});
