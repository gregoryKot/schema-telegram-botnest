#!/usr/bin/env node
// Драйв-гард парных файлов (аудит 2026-07, этап 3в волна 1; правило №3
// CLAUDE.md «парные файлы правятся парой»).
//
// Аудит нашёл 3+ случая, когда фикс доехал только до одного фронтенда.
// Волна 2 сделана: единственная копия живёт в shared/src, а пары ниже —
// однострочные реэкспорты (пути от обоих деревьев совпадают). Чекер
// продолжает держать их побайтово идентичными: подмена реэкспорта на
// локальную реализацию в одном дереве роняет CI. addressForm/CrisisCard —
// настоящие копии (фронтенд-специфичный импорт ../api, см. shared/README).
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
  'utils/crisisMarkers.test.ts',
  'utils/todayInsight.ts',
  'utils/drafts.ts',
  'utils/addressForm.tsx',
  'utils/AddressFormProvider.tsx',
  'components/CrisisCard.tsx',
  'hooks/useYsqTest.ts',
  'utils/format.ts',
  'utils/storageKeys.ts',
  'utils/a11y.ts',
  'utils/reducedMotion.ts',
  'hooks/useReducedMotionPref.ts',
];

// Осознанно НЕ в списке (разошлись содержательно, или намеренное визуальное
// расхождение — см. shared/README и разбор волны 2 в CLAUDE.md):
// components/Celebration.tsx (текстовая логика вынесена в
// shared/src/utils/celebrationText.ts; сама вёрстка/canvas-анимация/стили
// остаются раздельными — у стрик-числа намеренно разный fontWeight),
// components/TherapyNote.tsx (различия — только форматирование кода и тип
// тире «–»/«—» в тексте; побайтовое выравнивание разобрано волной 2, но не
// применено — jscpd-храповик считает выровненную пару целиком новым клоном
// ≥70 токенов и растёт на файле такого размера сильнее, чем экономят прочие
// правки волны 2; см. shared/README),
// components/PairCard.tsx, components/WeeklyQuestion.tsx,
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
