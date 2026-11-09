// Тест гейта check-incident-registry.mjs (правило №20): закрытая issue
// `ci-alarm` с напоминанием бота обязана иметь строку в docs/INCIDENTS.md с
// номером issue и датой в её окне, иначе — запись в бейслайне с причиной.
//
// Данные GitHub — записанные ответы (test/fixtures/recorded/github-ci-alarm-*),
// а не сочинённые: формат комментариев бота («Всё ещё красный…», «Упали
// джобы: …») и есть то, по чему гейт отличает поломку от вспышки.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const ISSUES = read(
  'test/fixtures/recorded/github-ci-alarm-closed-issues.json',
);
const COMMENTS = read('test/fixtures/recorded/github-ci-alarm-comments.json');
const ARGS = ['--issues=gh/issues.json', '--comments=gh/comments.json'];

const HEADER = '| Дата | Симптом |\n| --- | --- |\n';
const issue = (
  number: number,
  created: string,
  closed: string,
  comments = 2,
) => ({
  number,
  title: 'Смок прода — красный прогон',
  state: 'closed',
  created_at: `${created}T10:00:00Z`,
  closed_at: `${closed}T12:00:00Z`,
  comments,
  labels: [{ name: 'ci-alarm' }],
});
const comment = (number: number, body: string) => ({
  issue_url: `https://api.github.com/repos/o/r/issues/${number}`,
  user: { login: 'github-actions[bot]' },
  created_at: '2026-11-01T00:00:00Z',
  body,
});
const REMINDER = 'Всё ещё красный (напоминание не чаще раза в 3 часа).';

function run(
  rows: string,
  issues: unknown[],
  comments: unknown[],
  baseline = {},
) {
  return runGate(
    'check-incident-registry.mjs',
    {
      'docs/INCIDENTS.md': HEADER + rows,
      'scripts/incident-registry-baseline.json': JSON.stringify(baseline),
      'gh/issues.json': JSON.stringify(issues),
      'gh/comments.json': JSON.stringify(comments),
    },
    { args: ARGS },
  );
}

describe('check-incident-registry.mjs', () => {
  it('настоящий реестр и бейслайн на записанных ответах GitHub — зелёный', () => {
    const recorded = new Set(
      (JSON.parse(ISSUES) as { number: number }[]).map((i) => String(i.number)),
    );
    const baseline = Object.fromEntries(
      Object.entries(
        JSON.parse(read('scripts/incident-registry-baseline.json')),
      ).filter(([k]) => recorded.has(k)),
    );
    const res = runGate(
      'check-incident-registry.mjs',
      {
        'docs/INCIDENTS.md': read('docs/INCIDENTS.md'),
        'scripts/incident-registry-baseline.json': JSON.stringify(baseline),
        'gh/issues.json': ISSUES,
        'gh/comments.json': COMMENTS,
      },
      { args: ARGS },
    );
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('с напоминанием 18');
  });

  it('контроль на тех же данных: из строки реестра убран номер #903 — красный', () => {
    const res = runGate(
      'check-incident-registry.mjs',
      {
        'docs/INCIDENTS.md': read('docs/INCIDENTS.md').replace(
          /#903(?!\d)/g,
          'issue',
        ),
        'scripts/incident-registry-baseline.json': read(
          'scripts/incident-registry-baseline.json',
        ),
        'gh/issues.json': ISSUES,
        'gh/comments.json': COMMENTS,
      },
      { args: ARGS },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      '#903 (2026-11-02 → 2026-11-05, напоминаний 4)',
    );
  });

  it('напоминание без строки — красный; строка с #N в окне — зелёный', () => {
    const issues = [issue(42, '2026-10-24', '2026-10-26')];
    const comments = [comment(42, REMINDER), comment(42, 'Снова отвечает: …')];
    const red = run('', issues, comments);
    expect(red.status).toBe(1);
    expect(red.stderr).toContain(
      '#42 (2026-10-24 → 2026-10-26, напоминаний 1): нет строки',
    );
    const green = run(
      '| 2026-10-25 | прод лежал (issue `ci-alarm` #42) |\n',
      issues,
      comments,
    );
    expect(green.status).toBe(0);
  });

  it('вспышка без напоминания строки не требует; «Упали джобы» ночной — требует', () => {
    const issues = [
      issue(7, '2026-10-01', '2026-10-01', 1),
      issue(8, '2026-10-02', '2026-10-04'),
    ];
    const comments = [
      comment(7, 'Снова отвечает: …'),
      comment(8, 'Упали джобы: browser-smoke.\n\nСсылка на прогон: …'),
    ];
    const res = run('', issues, comments);
    expect(res.status).toBe(1);
    expect(res.stderr).not.toContain('#7 ');
    expect(res.stderr).toContain('#8 ');
  });

  it('напоминание не от бота не считается', () => {
    const issues = [issue(9, '2026-10-02', '2026-10-04')];
    const human = { ...comment(9, REMINDER), user: { login: 'someone' } };
    expect(run('', issues, [human]).status).toBe(0);
  });

  it('строка с номером, но датой вне окна (±1 день) — красный с отдельным текстом', () => {
    const issues = [issue(42, '2026-10-24', '2026-10-26')];
    const res = run('| 2026-10-20 | другое (#42) |\n', issues, [
      comment(42, REMINDER),
    ]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('дата вне окна');
    const edge = run(
      '| 2026-10-27 | на день позже закрытия (#42) |\n',
      issues,
      [comment(42, REMINDER)],
    );
    expect(edge.status).toBe(0);
  });

  it('интервал строки: «→ ДД», «→ ММ-ДД», «(открыт)»', () => {
    const issues = [issue(5, '2026-10-20', '2026-10-21')];
    const c = [comment(5, REMINDER)];
    expect(run('| 2026-10-09 → 20 | (#5) |\n', issues, c).status).toBe(0);
    expect(run('| 2026-09-30 → 10-19 | (#5) |\n', issues, c).status).toBe(0);
    expect(
      run('| 2026-10-09 → 10-13 (открыт) | (#5) |\n', issues, c).status,
    ).toBe(0);
    expect(run('| 2026-10-09 → 10-13 | (#5) |\n', issues, c).status).toBe(1);
  });

  it('#4 не засчитывает #42 (номер сверяется целиком)', () => {
    const issues = [issue(4, '2026-10-24', '2026-10-26')];
    const res = run('| 2026-10-25 | (#42) |\n', issues, [comment(4, REMINDER)]);
    expect(res.status).toBe(1);
  });

  it('бейслайн: причина гасит красный; короткая причина и протухшие записи — красный', () => {
    const issues = [
      issue(42, '2026-10-24', '2026-10-26'),
      issue(43, '2026-10-24', '2026-10-24', 1),
    ];
    const c = [comment(42, REMINDER)];
    const reason = { reason: 'смок: только отставание деплоя, прод отвечал' };
    expect(run('', issues, c, { 42: reason }).status).toBe(0);
    const short = run('', issues, c, { 42: { reason: 'флак' } });
    expect(short.stderr).toContain('короче 20 символов');
    const covered = run('| 2026-10-25 | (#42) |\n', issues, c, { 42: reason });
    expect(covered.stderr).toContain('строка в реестре уже есть');
    const noReminder = run('', issues, c, { 42: reason, 43: reason });
    expect(noReminder.stderr).toContain('#43: у issue нет напоминаний');
    const gone = run('', issues, c, { 42: reason, 99: reason });
    expect(gone.stderr).toContain('#99: issue не найдена');
  });
});
