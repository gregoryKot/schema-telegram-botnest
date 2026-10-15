// Подключён в package.json → jest.setupFilesAfterEnv: после каждого файла
// спеков сверяет process.exitCode (см. exit-code-leak.ts). Этот afterAll
// регистрируется раньше хуков самого файла и потому выполняется до них: код,
// выставленный в собственном afterAll спека или асинхронно после него, здесь
// не виден — его ловит сторож nightly (scripts/jest-exit-guard.mjs, вердикт
// «ненулевой код при чистой сводке»).
import { takeLeakedExitCode } from './exit-code-leak';

const before = process.exitCode;

afterAll(() => {
  const leak = takeLeakedExitCode(before);
  if (leak) throw new Error(leak);
});
