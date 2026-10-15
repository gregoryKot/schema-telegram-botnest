// Тело запуска ротации — отдельно от точки входа (src/cli/rotate-encryption-key.ts),
// чтобы коды выхода и вывод проверялись юнит-тестом, а не только отдельным процессом.
import type { PrismaClient } from '@prisma/client';
import { rotateAll, summarize } from './rotate-all';

const KEY_RE = /^[0-9a-f]{64}$/i;

export interface RunDeps {
  /** Значение ENCRYPTION_KEY из окружения процесса. */
  key: string | undefined;
  connect: () => PrismaClient;
  log: (line: string) => void;
}

/** Код выхода процесса: 0 — всё ротировано, 1 — часть данных под старым ключом. */
export async function runRotation(deps: RunDeps): Promise<number> {
  // Без валидного текущего ключа crypto.ts вне production молча «шифрует»
  // обратно открытым текстом, а перешифровывать было бы не во что.
  if (!KEY_RE.test((deps.key ?? '').trim()))
    throw new Error(
      'ENCRYPTION_KEY не задан или не 64 hex-символа: ротировать не во что.',
    );
  const prisma = deps.connect();
  try {
    const report = await rotateAll(prisma, { log: deps.log });
    deps.log(`\n${summarize(report)}`);
    return report.failed.length === 0 ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}
