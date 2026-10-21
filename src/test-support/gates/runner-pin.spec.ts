// Гейт «образ раннера закреплён версией» (2026-10-20). С 19 октября GitHub
// переводит ubuntu-latest на Ubuntu 26, и на следующий день два несвязанных
// фронтовых PR покраснели на храповике покрытия бэкенда и e2e переноса БД —
// при зелёном локальном прогоне. Плавающая метка меняет среду CI без коммита
// в репозитории: красное появляется у того, кто ничего не трогал. Переход на
// новый образ — правка `runs-on` в отдельном PR, а не сюрприз.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { jobBlocks } from './workflow-yaml';

const DIR = join(process.cwd(), '.github', 'workflows');
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'));

/** Джобы, чей `runs-on` — плавающая метка `*-latest`. */
export function floatingRunners(text: string): string[] {
  const bad: string[] = [];
  for (const [id, block] of Object.entries(jobBlocks(text))) {
    const m = /^ {4}runs-on:[ \t]*(\S+)/m.exec(block);
    if (m && /-latest\b/.test(m[1])) bad.push(`${id}: runs-on: ${m[1]}`);
  }
  return bad;
}

const wf = (runsOn: string) =>
  `name: X\n\non:\n  push:\n\njobs:\n  build:\n    runs-on: ${runsOn}\n    timeout-minutes: 5\n    steps:\n      - run: true\n`;

describe('плавающая метка образа — красная', () => {
  it('ubuntu-latest называет джобу', () => {
    expect(floatingRunners(wf('ubuntu-latest'))).toEqual([
      'build: runs-on: ubuntu-latest',
    ]);
  });

  it('любая *-latest, не только ubuntu', () => {
    expect(floatingRunners(wf('macos-latest'))).toHaveLength(1);
  });

  it('контроль: закреплённая версия проходит', () => {
    expect(floatingRunners(wf('ubuntu-24.04'))).toEqual([]);
  });

  it('контроль: строка шага с ubuntu-latest не считается образом джобы', () => {
    const text = wf('ubuntu-24.04').replace(
      '      - run: true',
      '      - run: echo ubuntu-latest',
    );
    expect(floatingRunners(text)).toEqual([]);
  });
});

describe('настоящие воркфлоу', () => {
  it('воркфлоу найдены', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s: образ закреплён версией', (f) => {
    expect(floatingRunners(readFileSync(join(DIR, f), 'utf8'))).toEqual([]);
  });
});
