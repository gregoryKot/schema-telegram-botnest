// scripts/merge-lines.mjs — merge-драйвер docs/BACKLOG.md (`merge=lines-3way`).
// Встроенный union воскрешал строки, удалённые одной из сторон; контрольные
// тесты ниже держат и это: с union та же пара веток обязана вернуть удалённое.
import { spawnSync } from 'child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const REAL_SCRIPTS = join(__dirname, '..', '..', '..', 'scripts');
const FILE = 'docs/BACKLOG.md';

const doc = (open: string[], done: string[]) =>
  ['## Следующее', ...open, '', '## Сделано', ...done, '- ✅ старое', ''].join(
    '\n',
  );
const BASE = doc(['- ⬜ первое', '- ⬜ второе', '- ⬜ третье'], []);
// A закрыл «второе», B закрыл «третье»; оба дописали в одну точку «Сделано»
const SIDE_A = doc(['- ⬜ первое', '- ⬜ третье'], ['- ✅ второе (A)']);
const SIDE_B = doc(['- ⬜ первое', '- ⬜ второе'], ['- ✅ третье (B)']);

/** Настоящее слияние git: main (их сторона) вливается в ветку (наша). */
function gitMerge(
  driver: 'lines-3way' | 'union',
  ours: string,
  theirs: string,
  base = BASE,
): { status: number | null; text: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'merge-lines-'));
  try {
    const git = (...args: string[]) =>
      spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
    git('init', '-q', '-b', 'main', '.');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    mkdirSync(join(tmp, 'scripts'));
    mkdirSync(join(tmp, 'docs'));
    for (const f of ['merge-lines.mjs', 'merge-lines-core.mjs'])
      copyFileSync(join(REAL_SCRIPTS, f), join(tmp, 'scripts', f));
    git(
      'config',
      'merge.lines-3way.driver',
      'node scripts/merge-lines.mjs %O %A %B %P',
    );
    writeFileSync(join(tmp, '.gitattributes'), `${FILE} merge=${driver}\n`);
    const commit = (text: string, msg: string) => {
      writeFileSync(join(tmp, FILE), text);
      git('add', '-A');
      git('commit', '-qm', msg);
    };
    commit(base, 'база');
    git('checkout', '-qb', 'pr');
    commit(ours, 'ветка');
    git('checkout', '-q', 'main');
    commit(theirs, 'main');
    git('checkout', '-q', 'pr');
    const merge = git('merge', 'main', '-m', 'merge');
    return {
      status: merge.status,
      text: readFileSync(join(tmp, FILE), 'utf8'),
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

describe('merge-lines: бэклог сводится по базе, удалённое не воскресает', () => {
  it('обе стороны закрыли по строке: обе записи «Сделано» есть, удалённых строк нет', () => {
    const { status, text } = gitMerge('lines-3way', SIDE_A, SIDE_B);
    expect(status).toBe(0);
    // «их» добавление первым, «наше» следом, на том же месте
    expect(text).toBe(
      doc(['- ⬜ первое'], ['- ✅ третье (B)', '- ✅ второе (A)']),
    );
  });

  it('контроль: встроенный union на той же паре возвращает удалённые строки', () => {
    const { status, text } = gitMerge('union', SIDE_A, SIDE_B);
    expect(status).toBe(0);
    expect(text).toMatch(/- ⬜ (второе|третье)/);
  });

  it('одна и та же строка, закрытая обеими сторонами, уходит один раз', () => {
    const closed = doc(['- ⬜ первое', '- ⬜ третье'], ['- ✅ второе']);
    const { status, text } = gitMerge('lines-3way', closed, closed);
    expect(status).toBe(0);
    expect(text).toBe(closed);
  });

  it('общая запись, дописанная обеими сторонами в одну точку, не двоится', () => {
    const a = doc(['- ⬜ первое'], ['- ✅ общее', '- ✅ своё A']);
    const b = doc(['- ⬜ первое'], ['- ✅ общее', '- ✅ своё B']);
    const { status, text } = gitMerge(
      'lines-3way',
      a,
      b,
      doc(['- ⬜ первое'], []),
    );
    expect(status).toBe(0);
    expect(text).toBe(
      doc(['- ⬜ первое'], ['- ✅ общее', '- ✅ своё B', '- ✅ своё A']),
    );
  });

  it('правка строки одной стороной и новые строки другой — без конфликта', () => {
    const a = doc(['- 🔧 первое (PR)', '- ⬜ второе', '- ⬜ третье'], []);
    const b = doc(
      ['- ⬜ первое', '- ⬜ второе', '- ⬜ третье', '- ⬜ новое'],
      [],
    );
    const { status, text } = gitMerge('lines-3way', a, b);
    expect(status).toBe(0);
    expect(text).toBe(
      doc(['- 🔧 первое (PR)', '- ⬜ второе', '- ⬜ третье', '- ⬜ новое'], []),
    );
  });

  it('НЕ сводит строку, переписанную сторонами по-разному: конфликт с маркерами', () => {
    const a = doc(['- 🔧 первое (A)', '- ⬜ второе', '- ⬜ третье'], []);
    const b = doc(['- 🔧 первое (B)', '- ⬜ второе', '- ⬜ третье'], []);
    const { status, text } = gitMerge('lines-3way', a, b);
    expect(status).not.toBe(0);
    expect(text).toContain('<<<<<<<');
    expect(text).toContain('- 🔧 первое (A)');
    expect(text).toContain('- 🔧 первое (B)');
  });

  it('НЕ сводит «одна сторона закрыла, другая переписала» — правка не воскрешает строку молча', () => {
    const a = doc(['- ⬜ первое', '- ⬜ третье'], []);
    const b = doc(['- ⬜ первое', '- 🔧 второе (B)', '- ⬜ третье'], []);
    expect(gitMerge('lines-3way', a, b).status).not.toBe(0);
  });
});
