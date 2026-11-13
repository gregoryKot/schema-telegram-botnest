// Сверка автомержа бот-PR: воркфлоу dependabot-automerge.yml ↔ dependabot.yml.
// Решение владельца: сами в прод уезжают только patch и minor при зелёном CI;
// мажоры и /game (тестов нет) ждут агента.
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments, triggerBlocks } from './workflow-yaml';

const read = (...p: string[]) =>
  readFileSync(join(process.cwd(), '.github', ...p), 'utf8');

/** Условие шага, который включает auto-merge. */
function mergeCondition(text: string): string {
  const step = stripComments(text)
    .split(/^ {6}- /m)
    .find((s) => /gh pr merge/.test(s));
  return step ? step.slice(0, step.search(/^ {8}(?:env|run):/m)) : '';
}

function workflowViolations(text: string): string[] {
  const bad: string[] = [];
  const on = triggerBlocks(text);
  // pull_request_target дал бы токен с записью PR из форка.
  if (!('pull_request' in on) || 'pull_request_target' in on) {
    bad.push('триггер — только pull_request');
  }
  if (!/^ {4}if:.*user\.login == 'dependabot\[bot\]'/m.test(text)) {
    bad.push('джоба не ограничена PR автора dependabot[bot]');
  }
  const cond = mergeCondition(text);
  if (!/gh pr merge --auto --squash /.test(stripComments(text))) {
    bad.push('нет шага gh pr merge --auto --squash');
  }
  if (!/semver-patch'/.test(cond) || !/semver-minor'/.test(cond)) {
    bad.push('условие шага не называет patch и minor');
  }
  if (/semver-major/.test(text)) bad.push('мажор попал в автомерж');
  if (!/directory != '\/game'/.test(cond)) bad.push('/game не исключён');
  return bad;
}

/** Записи dependabot.yml: экосистема, каталог, день, время. */
const schedules = (text: string) =>
  stripComments(text)
    .split(/^ {2}- package-ecosystem: /m)
    .slice(1)
    .map((e) => ({
      eco: /^\S+/.exec(e)?.[0] ?? '',
      dir: /^ {4}directory: (\S+)/m.exec(e)?.[1] ?? '',
      day: /^ {6}day: (\w+)/m.exec(e)?.[1] ?? '',
      time: /^ {6}time: (\S+)/m.exec(e)?.[1] ?? '',
    }));

/** Под `strict` бот-PR, открытые разом, блокируют друг друга до следующей недели. */
function scheduleViolations(text: string): string[] {
  const auto = schedules(text).filter((e) => e.dir !== '/game');
  const bad = auto
    .filter((e) => !e.day || !e.time)
    .map((e) => `${e.eco} ${e.dir}: нет day или time`);
  const days = auto.map((e) => e.day).filter(Boolean);
  if (new Set(days).size !== days.length) bad.push('дни совпадают');
  return bad;
}

describe('автомерж бот-PR Dependabot', () => {
  const real = read('workflows', 'dependabot-automerge.yml');

  it('настоящий воркфлоу: patch и minor, без мажоров и /game', () => {
    expect(mergeCondition(real)).toContain('steps.meta.outputs.update-type');
    expect(workflowViolations(real)).toEqual([]);
  });

  it('настоящий dependabot.yml: у автомержимых записей разные дни', () => {
    const config = read('dependabot.yml');
    expect(schedules(config).map((e) => e.dir)).toEqual(
      expect.arrayContaining(['/', '/webapp', '/shared', '/game']),
    );
    expect(scheduleViolations(config)).toEqual([]);
  });

  describe('образцы', () => {
    it('красный: мажор в условии', () => {
      const withMajor = real.replace(
        "'version-update:semver-minor'",
        "'version-update:semver-major'",
      );
      expect(workflowViolations(withMajor)).toEqual([
        'условие шага не называет patch и minor',
        'мажор попал в автомерж',
      ]);
    });

    it('красный: pull_request_target, игра не исключена, любой автор', () => {
      const loose = real
        .replace('  pull_request:', '  pull_request_target:')
        .replace(/^ {4}if: .*\n/m, '')
        .replace(/ &&\n\s+steps\.meta\.outputs\.directory != '\/game'/, '');
      expect(workflowViolations(loose)).toEqual([
        'триггер — только pull_request',
        'джоба не ограничена PR автора dependabot[bot]',
        '/game не исключён',
      ]);
    });

    const entry = (dir: string, schedule: string) =>
      `  - package-ecosystem: npm\n    directory: ${dir}\n    schedule:\n      interval: weekly\n${schedule}`;
    const at = (day: string) => `      day: ${day}\n      time: '05:00'\n`;

    it('красный: общий день и запись без расписания', () => {
      const cfg = [
        entry('/', at('tuesday')),
        entry('/webapp', at('tuesday')),
        entry('/shared', ''),
      ].join('');
      expect(scheduleViolations(cfg)).toEqual([
        'npm /shared: нет day или time',
        'дни совпадают',
      ]);
    });

    it('контроль: разные дни зелёные, /game расписанием не связан', () => {
      const cfg = [
        entry('/', at('tuesday')),
        entry('/webapp', at('wednesday')),
        entry('/game', ''),
      ].join('');
      expect(scheduleViolations(cfg)).toEqual([]);
    });
  });
});
