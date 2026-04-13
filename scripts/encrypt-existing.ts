/**
 * One-time migration: encrypt all existing plaintext sensitive fields in the DB.
 * Run with: ENCRYPTION_KEY=<your_key> npx ts-node --project tsconfig.json scripts/encrypt-existing.ts
 *
 * Idempotent: already-encrypted values are detected and skipped.
 */

import { PrismaClient } from '@prisma/client';
import { encrypt, encryptJson } from '../src/utils/crypto';

const prisma = new PrismaClient();

function isAlreadyEncrypted(val: string | null | undefined): boolean {
  if (!val) return true;
  try {
    const buf = Buffer.from(val, 'base64');
    return buf.length >= 29; // 12 iv + 16 tag + 1+ data
  } catch {
    return false;
  }
}

function encIf(val: string | null | undefined): string | null {
  if (!val) return val ?? null;
  if (isAlreadyEncrypted(val)) return val;
  return encrypt(val);
}

function encJsonIf(val: unknown): string | null {
  if (val == null) return null;
  const s = typeof val === 'string' ? val : JSON.stringify(val);
  if (isAlreadyEncrypted(s)) return s;
  return encryptJson(typeof val === 'string' ? JSON.parse(val) : val);
}

async function main() {
  console.log('Starting encryption migration...\n');
  let total = 0;

  // Notes
  const notes = await prisma.note.findMany({ select: { userId: true, date: true, text: true } });
  for (const n of notes) {
    const enc = encIf(n.text);
    if (enc !== n.text) {
      await prisma.note.update({ where: { userId_date: { userId: n.userId, date: n.date } }, data: { text: enc! } });
      total++;
    }
  }
  console.log(`Note.text: ${notes.length} rows, ${total} encrypted`);

  // UserPractice
  let count = 0;
  const practices = await prisma.userPractice.findMany({ select: { id: true, text: true } });
  for (const p of practices) {
    const enc = encIf(p.text);
    if (enc !== p.text) { await prisma.userPractice.update({ where: { id: p.id }, data: { text: enc! } }); count++; total++; }
  }
  console.log(`UserPractice.text: ${practices.length} rows, ${count} encrypted`);

  // PracticePlan
  count = 0;
  const plans = await prisma.practicePlan.findMany({ select: { id: true, practiceText: true } });
  for (const p of plans) {
    const enc = encIf(p.practiceText);
    if (enc !== p.practiceText) { await prisma.practicePlan.update({ where: { id: p.id }, data: { practiceText: enc! } }); count++; total++; }
  }
  console.log(`PracticePlan.practiceText: ${plans.length} rows, ${count} encrypted`);

  // UserTask
  count = 0;
  const tasks = await prisma.userTask.findMany({ select: { id: true, text: true } });
  for (const t of tasks) {
    const enc = encIf(t.text);
    if (enc !== t.text) { await prisma.userTask.update({ where: { id: t.id }, data: { text: enc! } }); count++; total++; }
  }
  console.log(`UserTask.text: ${tasks.length} rows, ${count} encrypted`);

  // TherapistNote
  count = 0;
  const therapistNotes = await prisma.therapistNote.findMany({ select: { id: true, text: true } });
  for (const n of therapistNotes) {
    const enc = encIf(n.text);
    if (enc !== n.text) { await prisma.therapistNote.update({ where: { id: n.id }, data: { text: enc! } }); count++; total++; }
  }
  console.log(`TherapistNote.text: ${therapistNotes.length} rows, ${count} encrypted`);

  // SchemaDiaryEntry
  count = 0;
  const schemaEntries = await prisma.schemaDiaryEntry.findMany();
  for (const e of schemaEntries) {
    const update: Record<string, any> = {};
    const fields: Array<[string, string | null]> = [
      ['trigger', e.trigger], ['thoughts', e.thoughts], ['bodyFeelings', e.bodyFeelings],
      ['actualBehavior', e.actualBehavior], ['schemaOrigin', e.schemaOrigin],
      ['healthyView', e.healthyView], ['realProblems', e.realProblems],
      ['excessiveReactions', e.excessiveReactions], ['healthyBehavior', e.healthyBehavior],
    ];
    for (const [key, val] of fields) {
      const enc = encIf(val); if (enc !== val) update[key] = enc;
    }
    const encEmotions = encJsonIf(e.emotions);
    const emotionsStr = typeof e.emotions === 'string' ? e.emotions : JSON.stringify(e.emotions);
    if (encEmotions !== emotionsStr) update['emotions'] = encEmotions;
    if (Object.keys(update).length > 0) {
      await prisma.schemaDiaryEntry.update({ where: { id: e.id }, data: update });
      count++; total++;
    }
  }
  console.log(`SchemaDiaryEntry: ${schemaEntries.length} rows, ${count} encrypted`);

  // ModeDiaryEntry
  count = 0;
  const modeEntries = await prisma.modeDiaryEntry.findMany();
  for (const e of modeEntries) {
    const update: Record<string, any> = {};
    for (const key of ['situation', 'thoughts', 'feelings', 'bodyFeelings', 'actions', 'actualNeed', 'childhoodMemories'] as const) {
      const enc = encIf(e[key]); if (enc !== e[key]) update[key] = enc;
    }
    if (Object.keys(update).length > 0) {
      await prisma.modeDiaryEntry.update({ where: { id: e.id }, data: update });
      count++; total++;
    }
  }
  console.log(`ModeDiaryEntry: ${modeEntries.length} rows, ${count} encrypted`);

  // GratitudeDiaryEntry
  count = 0;
  const gratitude = await prisma.gratitudeDiaryEntry.findMany();
  for (const e of gratitude) {
    const enc = encJsonIf(e.items);
    const itemsStr = typeof e.items === 'string' ? e.items : JSON.stringify(e.items);
    if (enc !== itemsStr) {
      await prisma.gratitudeDiaryEntry.update({ where: { id: e.id }, data: { items: enc as any } });
      count++; total++;
    }
  }
  console.log(`GratitudeDiaryEntry: ${gratitude.length} rows, ${count} encrypted`);

  // ClientConceptualization
  count = 0;
  const concepts = await prisma.clientConceptualization.findMany();
  const CONCEPT_FIELDS = ['earlyExperience', 'unmetNeeds', 'triggers', 'copingStyles', 'goals', 'currentProblems', 'modeTransitions'] as const;
  for (const c of concepts) {
    const update: Record<string, any> = {};
    for (const key of CONCEPT_FIELDS) {
      const enc = encIf((c as any)[key]); if (enc !== (c as any)[key]) update[key] = enc;
    }
    // Encrypt text fields inside history snapshots
    const history = Array.isArray(c.history) ? c.history as any[] : [];
    const encHistory = history.map((snap: any) => {
      const s = { ...snap };
      for (const key of CONCEPT_FIELDS) {
        const enc = encIf(s[key]); if (enc !== s[key]) s[key] = enc;
      }
      return s;
    });
    const historyChanged = JSON.stringify(encHistory) !== JSON.stringify(history);
    if (historyChanged) update['history'] = encHistory;
    if (Object.keys(update).length > 0) {
      await (prisma.clientConceptualization.update as any)({ where: { id: c.id }, data: update });
      count++; total++;
    }
  }
  console.log(`ClientConceptualization: ${concepts.length} rows, ${count} encrypted`);

  console.log(`\nDone. Total rows updated: ${total}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
