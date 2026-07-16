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

const prisma = new PrismaClient();

// Minimal structural view of a Prisma model delegate — this script dispatches
// over models by runtime name, so it can't use the concrete generated types.
type Row = Record<string, unknown>;
interface Delegate {
  findMany(args: { select: Record<string, true> }): Promise<Row[]>;
  update(args: {
    where: { id: number | string };
    data: Record<string, string>;
  }): Promise<unknown>;
}

// (table prismaName, fields to rotate)
const TARGETS: Array<{ name: string; fields: string[] }> = [
  { name: 'note', fields: ['text', 'tags'] },
  {
    name: 'userSchemaNote',
    fields: [
      'triggers',
      'feelings',
      'thoughts',
      'origins',
      'reality',
      'healthyView',
      'behavior',
    ],
  },
  {
    name: 'userModeNote',
    fields: ['triggers', 'feelings', 'thoughts', 'needs', 'behavior'],
  },
  { name: 'userBeliefCheck', fields: ['belief', 'reframe'] },
  { name: 'userLetter', fields: ['text'] },
  { name: 'userSafePlace', fields: ['description'] },
  { name: 'userFlashcard', fields: ['reflection', 'action'] },
  { name: 'userPractice', fields: ['text'] },
  { name: 'practicePlan', fields: ['practiceText'] },
  {
    name: 'schemaDiaryEntry',
    fields: [
      'trigger',
      'thoughts',
      'bodyFeelings',
      'actualBehavior',
      'schemaOrigin',
      'healthyView',
      'realProblems',
      'excessiveReactions',
      'healthyBehavior',
      'schemaIds',
    ],
  },
  {
    name: 'modeDiaryEntry',
    fields: [
      'modeId',
      'situation',
      'thoughts',
      'feelings',
      'bodyFeelings',
      'actions',
      'actualNeed',
      'childhoodMemories',
    ],
  },
  { name: 'gratitudeDiaryEntry', fields: ['items'] },
  { name: 'userTask', fields: ['text'] },
  { name: 'therapistNote', fields: ['text'] },
  {
    name: 'clientConceptualization',
    fields: [
      'earlyExperience',
      'unmetNeeds',
      'triggers',
      'copingStyles',
      'goals',
      'currentProblems',
      'modeTransitions',
      'schemaIds',
      'modeIds',
    ],
  },
];

async function rotate() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY not set — nothing to rotate INTO.');
    process.exit(1);
  }
  const startedAt = Date.now();
  let grand = 0;

  for (const { name, fields } of TARGETS) {
    const repo = (prisma as unknown as Record<string, Delegate | undefined>)[
      name
    ];
    if (!repo?.findMany) {
      console.warn(`! Skipping ${name} — no Prisma model`);
      continue;
    }
    const select: Record<string, true> = { id: true };
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
          where: { id: row.id as number | string },
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

  // Also rotate User.mySchemaIds / myModeIds (JSON columns).
  const users = await prisma.user.findMany({
    select: { id: true, mySchemaIds: true, myModeIds: true },
  });
  let userTouched = 0;
  for (const u of users) {
    const patch: Record<string, string> = {};
    for (const f of ['mySchemaIds', 'myModeIds'] as const) {
      const v = u[f];
      if (typeof v !== 'string') continue;
      const fresh = reencrypt(v);
      if (fresh !== null && fresh !== v) patch[f] = fresh;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({
        where: { id: u.id },
        data: patch as Prisma.UserUpdateInput,
      });
      userTouched++;
    }
  }
  if (userTouched > 0) {
    console.log(`✓ user (clinical labels): ${userTouched}`);
    grand += userTouched;
  } else console.log(`  user (clinical labels): nothing to do`);

  console.log(
    `\nDone in ${Date.now() - startedAt}ms — ${grand} rows re-encrypted.`,
  );
  await prisma.$disconnect();
}

rotate().catch((e) => {
  console.error('Rotation failed:', e);
  process.exit(1);
});
