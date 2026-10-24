// Тест scripts/child-output.mjs — общего выхода гейтов-храповиков. Гейты
// check-coverage-ratchet / check-frontend-coverage-ratchet проверены целиком
// в своих спеках; здесь пинится сам механизм: process.exit после слива
// pipe не срезает хвост вывода и не меняет код возврата (находка
// 2026-10-24: в GitHub Actions терялись блок FAIL и сообщение храповика).
import { spawnSync } from 'child_process';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { REAL_SCRIPTS_DIR } from './gate-sandbox';

const MODULE_URL = pathToFileURL(
  join(REAL_SCRIPTS_DIR, 'child-output.mjs'),
).href;
const BYTES = 3 * 1024 * 1024;

// stdio по умолчанию у spawnSync — pipe, то есть ровно то, что видит CI.
const runModule = (body: string) =>
  spawnSync('node', ['--input-type=module', '-e', body], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

describe('child-output.mjs', () => {
  it('exitFlushed: весь вывод в обоих потоках доходит через pipe, код возврата сохранён', () => {
    const res = runModule(`
      import { exitFlushed } from ${JSON.stringify(MODULE_URL)};
      process.stdout.write('o'.repeat(${BYTES}) + 'END_OUT');
      process.stderr.write('e'.repeat(${BYTES}) + 'END_ERR');
      await exitFlushed(7);
    `);
    expect(res.status).toBe(7);
    expect(res.stdout.length).toBe(BYTES + 'END_OUT'.length);
    expect(res.stdout.endsWith('END_OUT')).toBe(true);
    expect(res.stderr.length).toBe(BYTES + 'END_ERR'.length);
    expect(res.stderr.endsWith('END_ERR')).toBe(true);
  });

  it('exitFlushed(0): нулевой код тоже не теряется', () => {
    const res = runModule(`
      import { exitFlushed } from ${JSON.stringify(MODULE_URL)};
      process.stdout.write('ok');
      await exitFlushed(0);
    `);
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('ok');
  });

  it('relayOutput: пересылает stdout и stderr дочернего процесса, пустое пропускает', () => {
    const res = runModule(`
      import { relayOutput } from ${JSON.stringify(MODULE_URL)};
      relayOutput({ stdout: 'child-out', stderr: 'child-err' });
      relayOutput({ stdout: '', stderr: undefined });
    `);
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('child-out');
    expect(res.stderr).toBe('child-err');
  });
});
