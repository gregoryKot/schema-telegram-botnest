// Зелёный по предку (scripts/merge-train-proof.mjs): обход исполняется
// по-настоящему в node против подставного `get`. Каждое решение — оба исхода.
import { execFileSync } from 'child_process';
import { join } from 'path';
import { pathToFileURL } from 'url';

const SCRIPTS = join(process.cwd(), 'scripts');
const url = (f: string) => pathToFileURL(join(SCRIPTS, f)).href;
const BUNDLE = 'scripts/bundle-size-baseline.json';

interface Commit {
  parents: string[];
  files?: string[];
  ci?: 'success' | 'failure' | 'cancelled';
}
interface Repo {
  commits: Record<string, Commit>;
  inMain: string[];
  /** Путь, на котором подставной API отвечает отказом. */
  broken?: string;
}
interface Pr {
  number: number;
  sha: string;
  checks: { state: string };
  flagged?: boolean;
  noTrain?: boolean;
  author?: string;
}

/** Зовёт экспорт модуля с подставным API; ответ — { out, asked, log }. */
function run<T>(repo: Repo, fn: string, arg: unknown) {
  const code = `
    const repo = ${JSON.stringify(repo)};
    const asked = [];
    const log = [];
    console.log = (line) => log.push(line);
    const get = async (path) => {
      asked.push(path);
      if (repo.broken && path.includes(repo.broken)) throw new Error('GET ' + path + ': HTTP 500');
      let m;
      if (path === '/r/rules/branches/main')
        return [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'backend' }] } }];
      if ((m = path.match(/^\\/r\\/commits\\/(\\w+)\\/check-runs/))) {
        const ci = repo.commits[m[1]].ci;
        return { check_runs: ci ? [{ id: 1, name: 'backend', status: 'completed', conclusion: ci, completed_at: '2026-01-01T00:00:00Z' }] : [] };
      }
      if ((m = path.match(/^\\/r\\/commits\\/(\\w+)$/))) {
        const c = repo.commits[m[1]];
        return { parents: c.parents.map((sha) => ({ sha })), files: (c.files ?? []).map((filename) => ({ filename })) };
      }
      if ((m = path.match(/^\\/r\\/compare\\/(\\w+)\\.\\.\\.main/))) return { behind_by: repo.inMain.includes(m[1]) ? 0 : 1 };
      throw new Error('нет ответа на ' + path);
    };
    const mod = await import(${JSON.stringify(url('merge-train-proof.mjs'))});
    const plan = await import(${JSON.stringify(url('merge-train-plan.mjs'))});
    const arg = ${JSON.stringify(arg)};
    const required = [{ context: 'backend', app: null }];
    const out = ${fn === 'greenAncestor' ? `await mod.greenAncestor({ get, R: '/r', required }, arg)` : `plan.pickCars(await mod.markProven({ get, R: '/r' }, arg)).map((p) => p.number)`};
    process.stdout.write(JSON.stringify({ out, asked, log }));
  `;
  const stdout = execFileSync('node', ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  });
  return JSON.parse(stdout) as { out: T; asked: string[]; log: string[] };
}

// Ветка как у авторов справочника: контент зелёный, дальше вливания main и бамп бандла.
const chain = (content: Commit): Repo => ({
  commits: {
    head: { parents: ['bump', 'm2'] },
    bump: { parents: ['merge'], files: [BUNDLE], ci: 'cancelled' },
    merge: { parents: ['content', 'm1'], ci: 'failure' },
    content,
    base: { parents: [] },
  },
  inMain: ['m1', 'm2'],
});
const ancestor = (repo: Repo) =>
  run<string | null>(repo, 'greenAncestor', 'head').out;

describe('поезд: зелёный по предку', () => {
  it('голову от зелёного предка отделяют только вливания main и бамп бейслайна — доказан; предок не зелёный — нет', () => {
    expect(
      ancestor(chain({ parents: ['base'], files: ['a.ts'], ci: 'success' })),
    ).toBe('content');
    expect(
      ancestor(chain({ parents: ['base'], files: ['a.ts'], ci: 'failure' })),
    ).toBeNull();
    expect(ancestor(chain({ parents: ['base'], files: ['a.ts'] }))).toBeNull();
  });

  it('после зелёного предка есть содержательный коммит — не доказан, даже если бейслайн правлен вместе с кодом', () => {
    const repo = chain({ parents: ['base'], files: ['a.ts'], ci: 'success' });
    repo.commits.bump.files = [BUNDLE, 'webapp/src/x.ts'];
    expect(ancestor(repo)).toBeNull();
  });

  it('merge-коммит чужой ветки (второй родитель не в main) непрозрачен; сама голова зелёным предком не считается', () => {
    const repo = chain({ parents: ['base'], files: ['a.ts'], ci: 'success' });
    repo.inMain = ['m2'];
    expect(ancestor(repo)).toBeNull();
    const lone: Repo = {
      commits: {
        head: { parents: ['base'], files: ['a.ts'], ci: 'success' },
        base: { parents: [] },
      },
      inMain: [],
    };
    expect(ancestor(lone)).toBeNull();
  });

  it('обход ограничен глубиной: зелёный предок за девятью вливаниями main не ищется', () => {
    const commits: Record<string, Commit> = {
      green: { parents: ['base'], files: ['a.ts'], ci: 'success' },
    };
    for (let i = 0; i < 9; i++)
      commits[i ? `c${i}` : 'head'] = {
        parents: [i === 8 ? 'green' : `c${i + 1}`, 'm1'],
      };
    expect(ancestor({ commits, inMain: ['m1'] })).toBeNull();
    commits.c3 = { parents: ['green', 'm1'] };
    expect(ancestor({ commits, inMain: ['m1'] })).toBe('green');
  });

  it('два отставших с идущим CI и зелёным предком едут поездом; без зелёного предка поезда нет', () => {
    const repo = chain({ parents: ['base'], files: ['a.ts'], ci: 'success' });
    const prs = (): Pr[] => [
      { number: 1, sha: 'head', checks: { state: 'pending' } },
      { number: 2, sha: 'head', checks: { state: 'cancelled' } },
    ];
    const ok = run<number[]>(repo, 'markProven', prs());
    expect(ok.out).toEqual([1, 2]);
    expect(ok.log.join('\n')).toContain('#1: зелёный по предку content');
    repo.commits.content.ci = 'failure';
    expect(run<number[]>(repo, 'markProven', prs()).out).toEqual([]);
  });

  it('зелёные на голове идут первыми, мест пять; с конфликтом, no-train и бот зависимостей не проверяются', () => {
    const repo = chain({ parents: ['base'], files: ['a.ts'], ci: 'success' });
    const green = [1, 2, 3, 4].map((number) => ({
      number,
      sha: `g${number}`,
      checks: { state: 'green' },
    }));
    const rest: Pr[] = [
      { number: 5, sha: 'head', checks: { state: 'pending' }, flagged: true },
      { number: 6, sha: 'head', checks: { state: 'pending' }, noTrain: true },
      {
        number: 7,
        sha: 'head',
        checks: { state: 'pending' },
        author: 'dependabot[bot]',
      },
      { number: 8, sha: 'head', checks: { state: 'pending' } },
      { number: 9, sha: 'head', checks: { state: 'pending' } },
    ];
    const r = run<number[]>(repo, 'markProven', [...green, ...rest]);
    expect(r.out).toEqual([1, 2, 3, 4, 8]);
    expect(r.asked.filter((p) => p === '/r/commits/head').length).toBe(1);
  });

  it('отказ API — пассажир не доказан и очередь не падает: предупреждение, поезда нет', () => {
    const repo = {
      ...chain({ parents: ['base'], files: ['a.ts'], ci: 'success' }),
      broken: '/commits/bump',
    };
    const r = run<number[]>(repo, 'markProven', [
      { number: 1, sha: 'head', checks: { state: 'pending' } },
      { number: 2, sha: 'head', checks: { state: 'pending' } },
    ]);
    expect(r.out).toEqual([]);
    expect(r.log.join('\n')).toContain(
      '::warning::#1: зелёный предок не проверен',
    );
  });
});
