// Подключён в setupFilesAfterEnv обоих конфигов jest (package.json и
// test/jest-e2e.json): после каждого файла сверяет process.exitCode (см.
// exit-code-leak.ts). Этот afterAll регистрируется раньше хуков самого файла и
// потому выполняется до них: код, выставленный в afterAll спека или после него,
// здесь не виден — его ловит сторож jest-exit-guard.mjs («ненулевой код при
// чистой сводке»).
import { takeLeakedExitCode } from './exit-code-leak';

const before = process.exitCode;

afterAll(() => {
  const leak = takeLeakedExitCode(before);
  if (leak) throw new Error(leak);
});
