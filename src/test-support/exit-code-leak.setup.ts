// Подключён в package.json → jest.setupFilesAfterEnv: после каждого файла
// спеков сверяет process.exitCode (см. exit-code-leak.ts).
import { takeLeakedExitCode } from './exit-code-leak';

const before = process.exitCode;

afterAll(() => {
  const leak = takeLeakedExitCode(before);
  if (leak) throw new Error(leak);
});
