// Шов «вызывающий воркфлоу → alarm.yml» (правило №24). Джоба alarm в
// nightly.yml и mutation-bot.yml — вызов переиспользуемого воркфлоу: без
// `if: always()` она не стартует после красной джобы, без `secrets: inherit`
// DM-шагу нечем писать, а права вызова — потолок для alarm.yml (просит больше —
// прогон не стартует вовсе). Общий заголовок issue у двух вызывающих вернул бы
// класс «зелёный mutation-bot закрывает тревогу nightly». Шаги — alarm-workflow.spec.ts.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { jobBlocks, triggerBlocks } from '../test-support/gates/workflow-yaml';
import { withInputs } from '../test-support/workflow-steps';

const DIR = join(process.cwd(), '.github', 'workflows');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'));

interface Input {
  required: boolean;
  default?: string;
}

/** Входы `on.workflow_call.inputs`: имя → обязательность и дефолт. */
function declaredInputs(text: string): Record<string, Input> {
  const out: Record<string, Input> = {};
  let cur = '';
  for (const l of (triggerBlocks(text).workflow_call ?? '').split('\n')) {
    const name = /^ {6}([\w-]+):\s*$/.exec(l);
    if (name) {
      cur = name[1];
      out[cur] = { required: false };
      continue;
    }
    const prop = /^ {8}(required|default):[ \t]*(.*?)[ \t]*$/.exec(l);
    if (!prop || !cur) continue;
    if (prop[1] === 'required') out[cur].required = prop[2] === 'true';
    else out[cur].default = prop[2];
  }
  return out;
}

/** Права джобы (`permissions:` с отступом 4): область → read/write. */
function permissionsOf(job: string): Record<string, string> {
  const lines = job.split('\n');
  const at = lines.findIndex((l) => /^ {4}permissions:\s*$/.test(l));
  const out: Record<string, string> = {};
  if (at < 0) return out;
  for (const l of lines.slice(at + 1)) {
    const m = /^ {6}([\w-]+):[ \t]*(\w+)/.exec(l);
    if (!m) break;
    out[m[1]] = m[2];
  }
  return out;
}

const RANK: Record<string, number> = { none: 0, read: 1, write: 2 };

/** Нарушения вызова alarm.yml одной джобой. */
function alarmCallProblems(job: string, callee: string): string[] {
  const bad: string[] = [];
  if (!/^ {4}if:[ \t]*always\(\)[ \t]*$/m.test(job))
    bad.push('нет if: always() — после красной джобы alarm не стартует');
  if (!/^ {4}secrets:[ \t]*inherit[ \t]*$/m.test(job))
    bad.push('нет secrets: inherit — DM-шагу нечем писать');
  const given = permissionsOf(job);
  for (const [scope, level] of Object.entries(
    permissionsOf(jobBlocks(callee).alarm ?? ''),
  )) {
    if ((RANK[given[scope]] ?? 0) < RANK[level])
      bad.push(`alarm.yml просит ${scope}: ${level}, вызов этого не даёт`);
  }
  const inputs = declaredInputs(callee);
  const passed = withInputs(job);
  if (passed.needs !== '${{ toJSON(needs) }}')
    bad.push('needs не toJSON(needs) — alarm не узнает, кто упал');
  for (const [name, spec] of Object.entries(inputs))
    if (spec.required && !passed[name]) bad.push(`нет входа ${name}`);
  for (const name of Object.keys(passed))
    if (!(name in inputs)) bad.push(`вход ${name} в alarm.yml не объявлен`);
  return bad;
}

const ALARM = read('alarm.yml');
const callers = files.flatMap((file) =>
  Object.entries(jobBlocks(read(file)))
    .filter(([, job]) =>
      /^ {4}uses:[ \t]*\.\/\.github\/workflows\/alarm\.yml[ \t]*$/m.test(job),
    )
    .map(([, job]) => [file, job] as const),
);

describe('вызов alarm.yml: образцы', () => {
  const GOOD = [
    '  alarm:',
    '    needs: [a]',
    '    if: always()',
    '    permissions:',
    '      issues: write',
    '    uses: ./.github/workflows/alarm.yml',
    '    with:',
    '      needs: ${{ toJSON(needs) }}',
    "      title: 'X — красный прогон'",
    "      dm: 'X упал'",
    '    secrets: inherit',
    '',
  ].join('\n');

  it('контроль: полный вызов — без замечаний', () => {
    expect(alarmCallProblems(GOOD, ALARM)).toEqual([]);
  });

  it.each([
    ['без if: always()', '    if: always()\n', '', 'if: always()'],
    ['без secrets: inherit', '    secrets: inherit\n', '', 'secrets: inherit'],
    [
      'права только на чтение',
      'issues: write',
      'issues: read',
      'issues: write',
    ],
    ['needs не из toJSON', '${{ toJSON(needs) }}', 'x', 'toJSON(needs)'],
    ['без обязательного входа', "      dm: 'X упал'\n", '', 'нет входа dm'],
    [
      'лишний вход',
      "      dm: 'X упал'\n",
      "      dm: 'X'\n      tag: y\n",
      'tag',
    ],
  ])('%s — замечание', (_name, from, to, problem) => {
    const job = GOOD.replace(from, to);
    expect(job).not.toBe(GOOD);
    expect(alarmCallProblems(job, ALARM).join('\n')).toContain(problem);
  });
});

describe('вызов alarm.yml: настоящие воркфлоу', () => {
  it('контракт alarm.yml: needs, title и dm обязательны, метка — ci-alarm', () => {
    expect(declaredInputs(ALARM)).toEqual({
      needs: { required: true },
      title: { required: true },
      label: { required: false, default: 'ci-alarm' },
      dm: { required: true },
    });
  });

  it('каждый объявленный вход шаги alarm.yml читают', () => {
    for (const name of Object.keys(declaredInputs(ALARM)))
      expect(ALARM).toContain(`\${{ inputs.${name} }}`);
  });

  it('вызывающие найдены сами: nightly.yml и mutation-bot.yml', () => {
    expect(callers.map(([file]) => file)).toEqual(
      expect.arrayContaining(['nightly.yml', 'mutation-bot.yml']),
    );
  });

  it.each(callers)('%s: вызов полный', (_file, job) => {
    expect(alarmCallProblems(job, ALARM)).toEqual([]);
  });

  it('у каждого вызывающего свой заголовок issue, метка — по умолчанию', () => {
    const passed = callers.map(([, job]) => withInputs(job));
    const titles = passed.map((p) => p.title);
    expect(new Set(titles).size).toBe(callers.length);
    expect(passed.filter((p) => p.label !== undefined)).toEqual([]);
  });
});
