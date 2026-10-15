// takeLeakedExitCode — проверка после каждого файла спеков (setupFilesAfterEnv).
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
