// Точка входа ротации ENCRYPTION_KEY: `npm run rotate-encryption`, в прод-образе —
// `node dist/cli/rotate-encryption-key.js` (nest build кладёт src/cli в dist,
// ts-node в образе нет — npm prune --production).
//
// Порядок (CLAUDE.md → «Ротация ENCRYPTION_KEY»):
//   1. новый ключ: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   2. Amvera: ENCRYPTION_KEY_OLD = <прежний ENCRYPTION_KEY>, ENCRYPTION_KEY = <новый>,
//      перезапуск — оба ключа активны.
//   3. в контейнере: node dist/cli/rotate-encryption-key.js
//      Скрипт обходит каждую зашифрованную колонку, расшифровывает любым
//      известным ключом и пишет шифротекст ТЕКУЩИМ. Код выхода 1 и строка
//      «НЕ ротировано: […]» — часть данных ещё под старым ключом.
//   4. Только при «Готово» и коде 0: убрать ENCRYPTION_KEY_OLD, перезапуск.
//
// Перезапускаемо: повторный прогон безопасен.
import { PrismaClient } from '@prisma/client';
import { buildPrismaAdapter } from '../prisma/prisma.service';
import { CLI_STATEMENT_TIMEOUT_MS } from '../prisma/statement-timeout';
import { runRotation } from './rotate-encryption/run';

runRotation({
  key: process.env.ENCRYPTION_KEY,
  // Свой порог: ротация читает таблицы целиком (statement-timeout.ts).
  connect: () =>
    new PrismaClient({ adapter: buildPrismaAdapter(CLI_STATEMENT_TIMEOUT_MS) }),
  log: console.log,
}).then(
  (code) => process.exit(code),
  (e) => {
    console.error('Ротация прервана:', e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
