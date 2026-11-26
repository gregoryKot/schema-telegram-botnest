// takeLeakedExitCode — проверка после каждого файла спеков (setupFilesAfterEnv).
import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { takeLeakedExitCode } from './exit-code-leak';

describe('takeLeakedExitCode', () => {
  const original = process.exitCode;
  afterEach(() => {
    process.exitCode = original;
  });

  it('код выставлен за время файла — ошибка с причиной, код сброшен к прежнему', () => {
    process.exitCode = 1;
    expect(takeLeakedExitCode(undefined)).toMatch(
      /process\.exitCode = 1.*bot\.catch/,
    );
    expect(process.exitCode).toBeUndefined();
  });

  it('КОНТРОЛЬ: код не трогали — молчит', () => {
    expect(takeLeakedExitCode(process.exitCode)).toBeNull();
  });

  it('КОНТРОЛЬ: ноль — не авария', () => {
    process.exitCode = 0;
    expect(takeLeakedExitCode(undefined)).toBeNull();
  });
});

// Сторож подключён в ОБА конфига jest: юнит (package.json, rootDir src) и e2e
// (test/jest-e2e.json, rootDir test). До 2026-11 e2e его не подключал, и
// e2e-спек с утёкшим кодом выхода краснел шагом CI без объяснения.
describe('exit-code-leak.setup.ts подключён', () => {
  const ROOT = resolve(__dirname, '..', '..');
  const SETUP = join(ROOT, 'src', 'test-support', 'exit-code-leak.setup.ts');
  const resolveIn = (configFile: string, rootDir: string, entry: string) =>
    resolve(dirname(configFile), entry.replace('<rootDir>', rootDir));

  it.each([
    ['package.json', (j: { jest: unknown }) => j.jest],
    ['test/jest-e2e.json', (j: unknown) => j],
  ])('%s → setupFilesAfterEnv указывает на настоящий файл', (file, pick) => {
    const path = join(ROOT, file);
    const config = pick(JSON.parse(readFileSync(path, 'utf8'))) as {
      rootDir: string;
      setupFilesAfterEnv?: string[];
    };
    const resolved = (config.setupFilesAfterEnv ?? []).map((e) =>
      resolveIn(path, config.rootDir, e),
    );
    expect(resolved).toContain(SETUP);
    expect(existsSync(SETUP)).toBe(true);
  });
});
