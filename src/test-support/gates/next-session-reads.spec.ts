// Тест гейта check-next-session-reads.mjs (класс 17 INCIDENTS: «следующее»
// хранится датой и стареет): чтение nextSession в сайте, shared и сервере —
// только первым аргументом upcomingSession, деструктуризация (в объявлении и в
// параметрах) — тоже чтение. Оба исхода, контрольные образцы и разрешённые
// места (файл + функция + счёт).
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
    [
      'деструктуризация в for-of',
      'for (const { nextSession } of rels) use(nextSession);',
    ],
    [
      'деструктуризация в for-of с переименованием',
      'for (const { nextSession: ns } of rels) use(ns);',
    ],
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

  it('shared/src и src тоже под гейтом; тесты — нет', () => {
    const bad = 'export const x = (c) => c.nextSession;\n';
    expect(run(bad, 'shared/src/therapy/x.ts').status).toBe(1);
    expect(run(bad, 'src/telegram/session-reminder.ts').status).toBe(1);
    expect(run(bad, 'webapp/src/sections/Card.test.tsx').status).toBe(0);
  });

  it('скрытые каталоги в обходе пропускаются', () => {
    const bad = 'export const x = (c) => c.nextSession;\n';
    expect(run(bad, 'src/.cache/x.ts').status).toBe(0);
  });

  describe('разрешённые места ALLOWED_READS: файл + функция + счёт', () => {
    const FILE = 'src/therapy/therapy-relations.service.ts';
    const allowed = [
      'export class S {',
      '  async getClients(id: bigint) {',
      '    return rels.map((rel) => ({',
      '      nextSession: rel.nextSession ?? null,',
      '      other: { nextSession: rel.nextSession ?? null },',
      '    }));',
      '  }',
    ];
    const close = ['}', ''];

    it('разрешённое место с совпавшим счётом — зелёный', () => {
      const res = run([...allowed, ...close].join('\n'), FILE);
      expect(res.stderr).toBe('');
      expect(res.status).toBe(0);
    });

    it('новое чтение в другой функции бывшего исключённого файла — красный', () => {
      const src = [
        ...allowed,
        '  remind(rel: R) {',
        '    return rel.nextSession;',
        '  }',
        ...close,
      ].join('\n');
      const res = run(src, FILE);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `${FILE}:9: nextSession читается мимо upcomingSession`,
      );
    });

    it('лишнее чтение в той же функции — красный по счёту', () => {
      const src = [
        ...allowed.slice(0, 5),
        '      due: rel.nextSession,',
        ...allowed.slice(5),
        ...close,
      ].join('\n');
      const res = run(src, FILE);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `${FILE}:4: в getClients чтений nextSession 3, разрешено 2 (ALLOWED_READS)`,
      );
    });

    it('чтение в другом безымянном колбэке разрешённой функции — красный по счёту', () => {
      const src = [
        ...allowed.slice(0, 2),
        '    rels.forEach((r) => queue.push(() => r.nextSession));',
        ...allowed.slice(2),
        ...close,
      ].join('\n');
      const res = run(src, FILE);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `${FILE}:3: в getClients чтений nextSession 3, разрешено 2 (ALLOWED_READS)`,
      );
    });

    it('чтение ушло из функции — красный: запись надо снять', () => {
      const src = [
        'export class S {',
        '  async getClients(id: bigint) {',
        '    return [];',
        '  }',
        ...close,
      ].join('\n');
      const res = run(src, FILE);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        `${FILE}: в getClients чтений nextSession нет, а разрешено 2`,
      );
    });

    it('одно и то же имя функции в другом файле не разрешено', () => {
      const src = [...allowed, ...close].join('\n');
      expect(run(src, 'src/therapy/other.service.ts').status).toBe(1);
    });

    it('readSites называет ближайшую именованную функцию, колбэки — наружу', () => {
      const src = [
        'const a = rel.nextSession;',
        'function outer() {',
        '  return list.map((r) => r.nextSession);',
        '}',
        'const pick = ({ nextSession }: R) => nextSession;',
      ].join('\n');
      const sites: unknown = JSON.parse(
        importExport(
          'next-session-reads-rules.mjs',
          'readSites',
          `(fn) => fn(${JSON.stringify(src)})`,
        ),
      );
      expect(sites).toEqual([
        { line: 1, fn: '<module>' },
        { line: 3, fn: 'outer' },
        { line: 5, fn: 'pick' },
      ]);
    });

    it('список мест — те же пять файлов, по месту на файл', () => {
      // Записи — объекты; loadStringList отдаёт список как есть.
      const entries = (
        loadStringList(
          'check-next-session-reads.mjs',
          'ALLOWED_READS',
        ) as unknown as { file: string; fn: string; count: number }[]
      ).map((e) => `${e.file}#${e.fn}:${e.count}`);
      expect(entries).toEqual([
        'shared/src/therapy/useSessionAliasEditing.ts#resetSessionAlias:1',
        'src/therapy/therapy-relations.service.ts#getClients:2',
        'src/therapy/therapy-relation-info.ts#getRelationInfo:1',
        'src/therapy/therapy-invite-attach.ts#attachOfflineCard:2',
        'src/therapy/session-info-data.ts#sessionInfoData:2',
      ]);
    });
  });
});
