// Тест гейта check-next-session-reads.mjs (класс 17 INCIDENTS: «следующее»
// хранится датой и стареет): чтение nextSession в сайте, shared и сервере —
// только первым аргументом upcomingSession, деструктуризация (в объявлении и в
// параметрах) — тоже чтение. Оба исхода, контрольные образцы и исключения.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { importExport, loadStringList } from './pattern-loader';

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
    [
      'деструктуризация в параметрах стрелки',
      'const pick = ({ nextSession }: Row) => nextSession;',
    ],
    [
      'деструктуризация в параметрах функции',
      'function Card({ meetingDays, nextSession: at }: Props) { return at; }',
    ],
    [
      'вложенная деструктуризация в параметрах',
      'rows.map(({ rel: { nextSession } }) => nextSession);',
    ],
    [
      'деструктуризация в параметрах метода',
      'class A { label(n: number, { nextSession = null }: Row) { return nextSession; } }',
    ],
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
      'тип параметра, а не деструктуризация',
      'const at = (r: { nextSession: string | null }) => upcomingSession(r.nextSession, []);',
    ],
    [
      'литерал типа в дженерике параметра',
      'const n = (m: Record<string, { nextSession: string }>) => Object.keys(m).length;',
    ],
    [
      'упоминание в комментарии',
      '// раньше читали relation.nextSession напрямую',
    ],
  ])('контроль, зелёный: %s', (_name, line) => {
    expect(run(`export function f() {\n  ${line}\n}\n`).status).toBe(0);
  });

  it('directReads сводит три вида чтения по строкам: по одной на строку, по порядку', () => {
    const src = [
      'const a = rel.nextSession;',
      'const pick = ({ nextSession }: R) => upcomingSession(rel.nextSession, []);',
      'const { nextSession } = rel; const b = c?.nextSession;',
    ].join('\n');
    const lines: unknown = JSON.parse(
      importExport(
        'next-session-reads-rules.mjs',
        'directReads',
        `(fn) => fn(${JSON.stringify(src)})`,
      ),
    );
    expect(lines).toEqual([1, 2, 3]);
  });

  it('shared/src и src тоже под гейтом; тесты и EXEMPT_FILES — нет', () => {
    const bad = 'export const x = (c) => c.nextSession;\n';
    expect(run(bad, 'shared/src/therapy/x.ts').status).toBe(1);
    expect(run(bad, 'src/telegram/session-reminder.ts').status).toBe(1);
    expect(run(bad, 'webapp/src/sections/Card.test.tsx').status).toBe(0);
    expect(run(bad, 'src/therapy/therapy-relations.service.ts').status).toBe(0);
    expect(
      run(bad, 'shared/src/therapy/useSessionAliasEditing.ts').status,
    ).toBe(0);
    expect(
      loadStringList('check-next-session-reads.mjs', 'EXEMPT_FILES'),
    ).toEqual([
      'shared/src/therapy/useSessionAliasEditing.ts',
      'src/therapy/therapy-relations.service.ts',
      'src/therapy/therapy-relation-info.ts',
      'src/therapy/therapy-invite-attach.ts',
      'src/therapy/therapy-client-data.service.ts',
    ]);
  });
});
