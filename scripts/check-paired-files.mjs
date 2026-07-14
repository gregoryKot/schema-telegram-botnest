#!/usr/bin/env node
// Драйв-гард парных файлов (аудит 2026-07, этап 3в волна 1; правило №3
// CLAUDE.md «парные файлы правятся парой»).
//
// Аудит нашёл 3+ случая, когда фикс доехал только до одного фронтенда.
// Пока общий код живёт копиями (волна 2 — настоящий shared-пакет через
// npm workspaces), этот чекер держит канонические пары ПОБАЙТОВО
// идентичными: правка одной копии без другой роняет CI.
//
// Починить: скопировать актуальную версию во второй фронтенд, например
//   cp webapp/src/<файл> schema-miniapp/src/<файл>
// Новый общий файл — добавь его в PAIRS (и создай в обоих деревьях).
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');

// Канонические пары: webapp/src/<p> ↔ schema-miniapp/src/<p>.
const PAIRS = [
  'types.ts',
  'utils/therapistContact.ts',
  'utils/crisisMarkers.ts',
  'utils/todayInsight.ts',
  'utils/drafts.ts',
  'utils/addressForm.tsx',
  'components/CrisisCard.tsx',
];

// Осознанно НЕ в списке (разошлись содержательно; кандидаты волны 2 —
// выравнивание или вынос в shared): components/Celebration.tsx (тире+стили),
// components/PairCard.tsx, components/TherapyNote.tsx,
// components/WeeklyQuestion.tsx, utils/format.ts, utils/storageKeys.ts,
// needData.ts, schemaTherapyData.ts, api.ts.

let failed = false;
for (const p of PAIRS) {
  const a = join(ROOT, 'webapp/src', p);
  const b = join(ROOT, 'schema-miniapp/src', p);
  let contentA, contentB;
  try {
    contentA = readFileSync(a, 'utf8');
    contentB = readFileSync(b, 'utf8');
  } catch (e) {
    console.error(`❌ пара отсутствует: ${p} (${e.message})`);
    failed = true;
    continue;
  }
  if (contentA !== contentB) {
    console.error(
      `❌ парные файлы разошлись: ${p}\n` +
        `   webapp/src/${p} ≠ schema-miniapp/src/${p}\n` +
        `   Правило №3 CLAUDE.md: фикс вносится в оба в одном PR.\n` +
        `   diff webapp/src/${p} schema-miniapp/src/${p}`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`✓ парные файлы идентичны (${PAIRS.length} пар)`);
