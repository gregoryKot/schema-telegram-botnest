// Re-encrypts every encrypted field with the CURRENT ENCRYPTION_KEY.
//
// Procedure for key rotation:
//   1. Generate a new 32-byte key (hex):
//        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   2. In Amvera Settings:
//        ENCRYPTION_KEY_OLD = <previous ENCRYPTION_KEY value>
//        ENCRYPTION_KEY     = <new value from step 1>
//      Restart container — both keys are now active.
//   3. SSH into Amvera (or use exec) and run:
//        node dist/scripts/rotate-encryption-key.js
//      Script walks every encrypted column, decrypts with whichever known
//      key works, re-encrypts with the current key. Logs counts per table.
//   4. Remove ENCRYPTION_KEY_OLD from env. Restart.
//
// Re-runnable: re-encrypting an already-current value is a no-op cost-wise.

import { PrismaClient, Prisma } from '@prisma/client';
import { reencrypt } from '../src/utils/crypto';
import { TARGETS } from './rotate-encryption-targets';

const prisma = new PrismaClient();

// Minimal structural view of a Prisma model delegate — this script dispatches
// over models by runtime name, so it can't use the concrete generated types.
type Row = Record<string, unknown>;
interface Delegate {
  findMany(args: { select: Record<string, true> }): Promise<Row[]>;
  update(args: {
    where: Record<string, number | string>;
    data: Record<string, string>;
  }): Promise<unknown>;
}

async function rotate() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY not set — nothing to rotate INTO.');
    process.exit(1);
  }
  const startedAt = Date.now();
  let grand = 0;

  for (const { name, fields, pk = 'id' } of TARGETS) {
    const repo = (prisma as unknown as Record<string, Delegate | undefined>)[
      name
    ];
    if (!repo?.findMany) {
      console.warn(`! Skipping ${name} — no Prisma model`);
      continue;
    }
    const select: Record<string, true> = { [pk]: true };
    for (const f of fields) select[f] = true;
    const rows = await repo.findMany({ select });
    let touched = 0;
    for (const row of rows) {
      const patch: Record<string, string> = {};
      for (const f of fields) {
        const v = row[f];
        if (v == null) continue;
        // Encrypted blobs are strings. Skip arrays/objects (legacy plaintext JSON
        // already handled by migrateClinicalLabels on startup).
        if (typeof v !== 'string') continue;
        const fresh = reencrypt(v);
        if (fresh !== null && fresh !== v) patch[f] = fresh;
      }
      if (Object.keys(patch).length > 0) {
        await repo.update({
          where: { [pk]: row[pk] as number | string },
          data: patch,
        });
        touched++;
      }
    }
    if (touched > 0) {
      console.log(`✓ ${name}: re-encrypted ${touched}/${rows.length} rows`);
      grand += touched;
    } else {
      console.log(`  ${name}: nothing to do (${rows.length} rows)`);
    }
  }

  // User-колонки: клинические ярлыки (mySchemaIds/myModeIds) + 2FA-секреты
  // (totpSecret, totpRecoveryCodes) — H4: без них ротация оставляла бы 2FA под
  // старым ключом и убивала бы её при удалении ENCRYPTION_KEY_OLD.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      mySchemaIds: true,
      myModeIds: true,
      totpSecret: true,
      totpRecoveryCodes: true,
    },
  });
  let userTouched = 0;
  for (const u of users) {
    const patch: Record<string, string> = {};
    for (const f of [
      'mySchemaIds',
      'myModeIds',
      'totpSecret',
      'totpRecoveryCodes',
    ] as const) {
      const v = u[f];
      if (typeof v !== 'string') continue;
      const fresh = reencrypt(v);
      if (fresh !== null && fresh !== v) patch[f] = fresh;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({
        where: { id: u.id },
        data: patch,
      });
      userTouched++;
    }
  }
  if (userTouched > 0) {
    console.log(`✓ user (clinical labels): ${userTouched}`);
    grand += userTouched;
  } else console.log(`  user (clinical labels): nothing to do`);

  // clientConceptualization.history — JSON-массив снапшотов концептуализации,
  // у каждого поля зашифрованы ОТДЕЛЬНЫМИ строками (не одна строка-колонка),
  // поэтому общий цикл выше их не трогает (значение — массив, не строка).
  // Ротируем вложенно: у каждого снапшота перешифровываем каждое строковое
  // поле. reencrypt безопасен на не-шифртексте (дата/версия) — возвращает его
  // без изменений (crypto.ts: decrypted===value → return value).
  const concepts = await prisma.clientConceptualization.findMany({
    select: { id: true, history: true },
  });
  let histTouched = 0;
  for (const c of concepts) {
    const hist = c.history;
    if (!Array.isArray(hist)) continue;
    let changed = false;
    const rotated = hist.map((snap) => {
      if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return snap;
      const out: Record<string, unknown> = {
        ...(snap as Record<string, unknown>),
      };
      for (const [k, v] of Object.entries(out)) {
        if (typeof v !== 'string') continue;
        const fresh = reencrypt(v);
        if (fresh !== null && fresh !== v) {
          out[k] = fresh;
          changed = true;
        }
      }
      return out;
    });
    if (changed) {
      await prisma.clientConceptualization.update({
        where: { id: c.id },
        data: { history: rotated as Prisma.InputJsonValue },
      });
      histTouched++;
    }
  }
  if (histTouched > 0) {
    console.log(`✓ clientConceptualization.history: ${histTouched}`);
    grand += histTouched;
  } else console.log(`  clientConceptualization.history: nothing to do`);

  console.log(
    `\nDone in ${Date.now() - startedAt}ms — ${grand} rows re-encrypted.`,
  );
  await prisma.$disconnect();
}

rotate().catch((e) => {
  console.error('Rotation failed:', e);
  process.exit(1);
});
