// Тест гейта check-next-session-reads.mjs (класс 17 INCIDENTS: «следующее»
// хранится датой и стареет): чтение nextSession во фронтах — только первым
// аргументом upcomingSession. Оба исхода, контрольные образцы и исключение
// формы правки.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

const ROOT = join(__dirname, '..', '..', '..');
const run = (src: string, path = 'webapp/src/sections/Card.tsx') =>
  runGate('check-next-session-reads.mjs', { [path]: src });

describe('check-next-session-reads.mjs', () => {
  it('настоящее дерево — зелёный', () => {
    const res = spawnSync('node', ['scripts/check-next-session-reads.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it.each([
    [
      'прямое чтение в JSX',
      'const label = nextSessionLabel(relation.nextSession);',
    ],
    ['optional chaining', 'const at = client?.nextSession ?? null;'],
    ['деструктуризация', 'const { nextSession, meetingDays } = relation;'],
    ['деструктуризация с переименованием', 'let { nextSession: ns } = client;'],
    ['сравнение, а не присваивание', 'if (a.nextSession == b) return;'],
  ])('красный: %s', (_name, line) => {
    const res = run(`export function f() {\n  ${line}\n}\n`);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/sections/Card.tsx:2: nextSession читается мимо upcomingSession',
    );
  });

  it.each([
    [
      'через шлюз',
      'const at = upcomingSession(relation.nextSession, relation.meetingDays);',
    ],
    [
      'шлюз с optional chaining',
      'const at = upcomingSession(c?.nextSession, [], today);',
    ],
    ['запись', 'draft.nextSession = value;'],
    [
      'ключ объекта и тип',
      'save({ nextSession: toIso(v) }); type R = { nextSession: string | null };',
    ],
    [
      'упоминание в комментарии',
      '// раньше читали relation.nextSession напрямую',
    ],
  ])('контроль, зелёный: %s', (_name, line) => {
    expect(run(`export function f() {\n  ${line}\n}\n`).status).toBe(0);
  });

  it('shared/src тоже под гейтом; тесты и форма правки — нет', () => {
    const bad = 'export const x = (c) => c.nextSession;\n';
    expect(run(bad, 'shared/src/therapy/x.ts').status).toBe(1);
    expect(run(bad, 'webapp/src/sections/Card.test.tsx').status).toBe(0);
    expect(
      run(bad, 'shared/src/therapy/useSessionAliasEditing.ts').status,
    ).toBe(0);
    expect(
      loadStringList('check-next-session-reads.mjs', 'EXEMPT_FILES'),
    ).toEqual(['shared/src/therapy/useSessionAliasEditing.ts']);
  });
});
