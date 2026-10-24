// Сверка «копия ruleset `main` ↔ джобы ci.yml» (аудит 2026-10, правило №13).
// Ruleset живёт в настройках GitHub, а его копия — в .github/rulesets/main.json
// (из неё владелец импортирует набор правил). Два места обязаны совпадать
// (правило №4): обязательная проверка, которую ни одна джоба не присылает,
// держит каждый PR в «Expected — Waiting for status» навсегда, а новая джоба
// вне списка краснеет, не мешая мержу. Живой ruleset этот тест не видит:
// поменял набор джоб — владелец правит ruleset в настройках (порядок — в
// .claude/rules/gates.md, №13).
//
// Две стороны, и красной должна быть каждая: проверка без джобы и джоба без
// проверки. Плюс то, без чего класс «красный merge-коммит на устаревшей базе»
// возвращается: `strict`, запрет force-push и удаления, только через PR, без
// обходов и без обязательного одобрения (мержат агенты, правило №1а).
import { readFileSync } from 'fs';
import { join } from 'path';
import { jobBlocks } from './workflow-yaml';

type Rule = { type: string; parameters?: Record<string, unknown> };
type Ruleset = {
  enforcement?: string;
  conditions?: { ref_name?: { include?: string[] } };
  bypass_actors?: unknown[];
  rules?: Rule[];
};

const ROOT = process.cwd();
const RULESET = join(ROOT, '.github', 'rulesets', 'main.json');
const CI = join(ROOT, '.github', 'workflows', 'ci.yml');

/** Имя проверки, которое присылает джоба: `name:` джобы, иначе её ключ. */
function checkNames(ciText: string): { names: string[]; bad: string[] } {
  const names: string[] = [];
  const bad: string[] = [];
  for (const [id, block] of Object.entries(jobBlocks(ciText))) {
    if (/^ {4}strategy:/m.test(block)) {
      bad.push(
        `джоба ${id} с matrix присылает имена с суффиксом — гейт их не знает`,
      );
      continue;
    }
    const name = /^ {4}name:[ \t]*(.+?)[ \t]*$/m.exec(block)?.[1];
    names.push(name ? name.replace(/^(['"])(.*)\1$/, '$2') : id);
  }
  return { names, bad };
}

function rulesetViolations(rs: Ruleset, ciText: string): string[] {
  const bad: string[] = [];
  const rule = (t: string) => rs.rules?.find((r) => r.type === t);
  if (rs.enforcement !== 'active') bad.push('enforcement не active');
  if (!rs.conditions?.ref_name?.include?.includes('refs/heads/main')) {
    bad.push('ruleset не нацелен на refs/heads/main');
  }
  if ((rs.bypass_actors ?? []).length > 0) bad.push('есть bypass_actors');
  if (!rule('deletion')) bad.push('нет запрета удаления (deletion)');
  if (!rule('non_fast_forward')) bad.push('нет запрета force-push');
  const pr = rule('pull_request');
  if (!pr) bad.push('нет правила «только через PR»');
  else if (pr.parameters?.required_approving_review_count !== 0) {
    bad.push('PR требует одобрений — агенты не смогут мержить (№1а)');
  }
  const sc = rule('required_status_checks')?.parameters;
  if (!sc) return [...bad, 'нет обязательных проверок'];
  if (sc.strict_required_status_checks_policy !== true) {
    bad.push(
      'strict выключен — merge-коммит на устаревшей базе снова краснеет',
    );
  }
  const required = new Set(
    ((sc.required_status_checks ?? []) as { context: string }[]).map(
      (c) => c.context,
    ),
  );
  const { names, bad: jobBad } = checkNames(ciText);
  bad.push(...jobBad);
  for (const n of names) {
    if (!required.has(n)) bad.push(`джоба ${n} не в обязательных проверках`);
  }
  for (const r of required) {
    if (!names.includes(r)) bad.push(`проверку ${r} никто не присылает`);
  }
  return bad;
}

describe('ruleset main ↔ ci.yml', () => {
  it('копия ruleset совпадает с джобами ci.yml', () => {
    const rs = JSON.parse(readFileSync(RULESET, 'utf8')) as Ruleset;
    expect(rulesetViolations(rs, readFileSync(CI, 'utf8'))).toEqual([]);
  });

  describe('образцы', () => {
    const wf = (jobs: string) =>
      `name: CI\non:\n  pull_request:\njobs:\n${jobs}`;
    const job = (id: string, extra = '') =>
      `  ${id}:\n${extra}    runs-on: ubuntu-latest\n    steps:\n      - run: true\n`;
    const CI_AB = wf(job('a') + job('b'));
    const good = (): Ruleset => ({
      enforcement: 'active',
      conditions: { ref_name: { include: ['refs/heads/main'] } },
      bypass_actors: [],
      rules: [
        { type: 'deletion' },
        { type: 'non_fast_forward' },
        {
          type: 'pull_request',
          parameters: { required_approving_review_count: 0 },
        },
        {
          type: 'required_status_checks',
          parameters: {
            strict_required_status_checks_policy: true,
            required_status_checks: [{ context: 'a' }, { context: 'b' }],
          },
        },
      ],
    });
    const without = (t: string): Ruleset => ({
      ...good(),
      rules: good().rules!.filter((r) => r.type !== t),
    });
    const withParams = (t: string, p: Record<string, unknown>): Ruleset => ({
      ...good(),
      rules: good().rules!.map((r) =>
        r.type === t ? { ...r, parameters: { ...r.parameters, ...p } } : r,
      ),
    });

    it('зелёный: полный ruleset на те же джобы', () => {
      expect(rulesetViolations(good(), CI_AB)).toEqual([]);
    });

    it('красный: новая джоба не стала обязательной', () => {
      expect(
        rulesetViolations(good(), wf(job('a') + job('b') + job('c'))),
      ).toEqual(['джоба c не в обязательных проверках']);
    });

    it('красный: обязательная проверка без джобы держит все PR', () => {
      expect(rulesetViolations(good(), wf(job('a')))).toEqual([
        'проверку b никто не присылает',
      ]);
    });

    it('красный: strict выключен', () => {
      const rs = withParams('required_status_checks', {
        strict_required_status_checks_policy: false,
      });
      expect(rulesetViolations(rs, CI_AB)).toEqual([
        expect.stringContaining('strict выключен'),
      ]);
    });

    it('красный: нет запрета force-push, удаления, PR', () => {
      expect(rulesetViolations(without('non_fast_forward'), CI_AB)).toEqual([
        'нет запрета force-push',
      ]);
      expect(rulesetViolations(without('deletion'), CI_AB)).toEqual([
        'нет запрета удаления (deletion)',
      ]);
      expect(rulesetViolations(without('pull_request'), CI_AB)).toEqual([
        'нет правила «только через PR»',
      ]);
    });

    it('красный: обход или обязательное одобрение', () => {
      expect(
        rulesetViolations(
          { ...good(), bypass_actors: [{ actor_id: 5 }] },
          CI_AB,
        ),
      ).toEqual(['есть bypass_actors']);
      const rs = withParams('pull_request', {
        required_approving_review_count: 1,
      });
      expect(rulesetViolations(rs, CI_AB)).toEqual([
        expect.stringContaining('требует одобрений'),
      ]);
    });

    it('контроль: у джобы с name: проверка зовётся по name, не по ключу', () => {
      const named = wf(job('a') + job('b-id', "    name: 'b'\n"));
      expect(rulesetViolations(good(), named)).toEqual([]);
      const plain = wf(job('a') + job('b-id'));
      expect(rulesetViolations(good(), plain)).toEqual([
        'джоба b-id не в обязательных проверках',
        'проверку b никто не присылает',
      ]);
    });

    it('контроль: джоба с matrix не засчитывается молча', () => {
      const matrix = wf(
        job('a') +
          job('b', '    strategy:\n      matrix:\n        n: [1, 2]\n'),
      );
      expect(rulesetViolations(good(), matrix)).toEqual([
        expect.stringContaining('джоба b с matrix'),
        'проверку b никто не присылает',
      ]);
    });
  });
});
