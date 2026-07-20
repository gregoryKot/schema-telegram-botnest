/**
 * One-time migration, волна 2 (аудит 2026-07-20): дошифровать исторические
 * plaintext-строки в полях, которые начали шифроваться коммитом a187ef8 —
 * DiaryDraft.data, YsqProgress/YsqResult/YsqResultHistory.answers,
 * TherapistRequest.*, TherapyRelation.clientAlias/virtualClientName,
 * EmailToken.email. Новые записи уже шифруются в сервисах; этот скрипт
 * закрывает только данные, записанные ДО деплоя.
 *
 * Запуск (Amvera exec / локально с прод-URL БД):
 *   ENCRYPTION_KEY=<key> npx ts-node --project tsconfig.json scripts/encrypt-existing-wave2.ts
 *
 * Идемпотентен: «уже зашифровано» проверяется точно — попыткой расшифровки
 * текущими ключами (decrypt() возвращает plaintext без изменений), а не
 * base64-эвристикой волны 1, которая ложно пропускала длинный латинский текст.
 */

import { PrismaClient } from '@prisma/client';
import { encrypt, encryptJson, decrypt } from '../src/utils/crypto';

const prisma = new PrismaClient();

const isEncrypted = (v: string): boolean => decrypt(v) !== v;

// String-поле: null/пусто/уже шифровано → вернуть как есть, иначе зашифровать.
function encIf(val: string | null): string | null {
  if (!val || isEncrypted(val)) return val;
  return encrypt(val);
}

// Json-поле: уже-шифрованная строка → как есть; иначе шифроблоб от значения.
function encJsonIf(val: unknown): string | null {
  if (val == null) return null;
  if (typeof val === 'string' && isEncrypted(val)) return val;
  return encryptJson(val);
}

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY не задан — шифровать нечем');
  }
  console.log('Encryption migration, wave 2...\n');
  let total = 0;
  let count = 0;

  // DiaryDraft.data — черновики дневников (свободный текст)
  const drafts = await prisma.diaryDraft.findMany();
  count = 0;
  for (const d of drafts) {
    const enc = encJsonIf(d.data);
    if (enc !== null && enc !== d.data) {
      await prisma.diaryDraft.update({
        where: { userId_type: { userId: d.userId, type: d.type } },
        data: { data: enc },
      });
      count++;
      total++;
    }
  }
  console.log(`DiaryDraft.data: ${drafts.length} rows, ${count} encrypted`);

  // YSQ: ответы теста (клинический профиль)
  const progress = await prisma.ysqProgress.findMany();
  count = 0;
  for (const r of progress) {
    const enc = encJsonIf(r.answers);
    if (enc !== null && enc !== r.answers) {
      await prisma.ysqProgress.update({
        where: { userId: r.userId },
        data: { answers: enc },
      });
      count++;
      total++;
    }
  }
  console.log(`YsqProgress.answers: ${progress.length} rows, ${count} encrypted`);

  const results = await prisma.ysqResult.findMany();
  count = 0;
  for (const r of results) {
    const enc = encJsonIf(r.answers);
    if (enc !== null && enc !== r.answers) {
      await prisma.ysqResult.update({
        where: { userId: r.userId },
        data: { answers: enc },
      });
      count++;
      total++;
    }
  }
  console.log(`YsqResult.answers: ${results.length} rows, ${count} encrypted`);

  const history = await prisma.ysqResultHistory.findMany();
  count = 0;
  for (const r of history) {
    const enc = encJsonIf(r.answers);
    if (enc !== null && enc !== r.answers) {
      await prisma.ysqResultHistory.update({
        where: { id: r.id },
        data: { answers: enc },
      });
      count++;
      total++;
    }
  }
  console.log(
    `YsqResultHistory.answers: ${history.length} rows, ${count} encrypted`,
  );

  // TherapistRequest — PII заявителя
  const requests = await prisma.therapistRequest.findMany();
  count = 0;
  for (const r of requests) {
    const update: Record<string, string | null> = {};
    for (const f of ['fullName', 'qualification', 'contacts', 'message'] as const) {
      const enc = encIf(r[f]);
      if (enc !== r[f]) update[f] = enc;
    }
    if (Object.keys(update).length > 0) {
      await prisma.therapistRequest.update({ where: { id: r.id }, data: update });
      count++;
      total++;
    }
  }
  console.log(`TherapistRequest: ${requests.length} rows, ${count} encrypted`);

  // TherapyRelation — имена клиентов, введённые терапевтом
  const relations = await prisma.therapyRelation.findMany();
  count = 0;
  for (const r of relations) {
    const update: Record<string, string | null> = {};
    for (const f of ['clientAlias', 'virtualClientName'] as const) {
      const enc = encIf(r[f]);
      if (enc !== r[f]) update[f] = enc;
    }
    if (Object.keys(update).length > 0) {
      await prisma.therapyRelation.update({ where: { id: r.id }, data: update });
      count++;
      total++;
    }
  }
  console.log(`TherapyRelation: ${relations.length} rows, ${count} encrypted`);

  // EmailToken.email — адреса в magic-link токенах
  const tokens = await prisma.emailToken.findMany();
  count = 0;
  for (const t of tokens) {
    const enc = encIf(t.email);
    if (enc !== t.email) {
      await prisma.emailToken.update({
        where: { id: t.id },
        data: { email: enc! },
      });
      count++;
      total++;
    }
  }
  console.log(`EmailToken.email: ${tokens.length} rows, ${count} encrypted`);

  console.log(`\nDone. Total rows updated: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
