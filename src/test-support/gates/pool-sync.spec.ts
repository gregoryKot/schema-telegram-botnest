// Тест гейта check-pool-sync.mjs (аудит 2026-08, участок 3: живой пул канала
// «Здоровый Взрослый» в БД разошёлся с src/bot/healthy-adult.data.ts —
// дегендерный свип доехал до фолбэка, но синхронизирующей миграции не было,
// и подписчики канала получали версии с мужским родом). Гейт реконструирует
// итоговый пул из migration.sql (INSERT/UPDATE/DELETE) и сверяет с data.ts.
//
// Проверяем ОБА исхода: гейт краснеет, когда фраза в data.ts не подкреплена
// миграцией, и зеленеет на согласованном дереве — иначе ложно-красный гейт
// отключат через неделю (см. gate-sandbox.ts).
import { runGate } from './gate-sandbox';

const dataTs = (phrases: string[]) =>
  [
    'export const HEALTHY_ADULT_PHRASES: readonly string[] = [',
    ...phrases.map((p) => `  '${p.replace(/'/g, "\\'")}',`),
    '];',
    '',
  ].join('\n');

const seedMigration = (rows: [string, number][]) =>
  [
    'CREATE TABLE IF NOT EXISTS "HealthyAdultPhrase" ("id" SERIAL, "text" TEXT, "sortOrder" INTEGER, "updatedAt" TIMESTAMP(3));',
    'INSERT INTO "HealthyAdultPhrase" ("text", "sortOrder", "updatedAt")',
    'SELECT "text", "sortOrder", CURRENT_TIMESTAMP FROM (VALUES',
    rows.map(([text, order]) => `  ('${text.replace(/'/g, "''")}', ${order})`).join(',\n'),
    ') AS seed("text", "sortOrder")',
    'WHERE NOT EXISTS (SELECT 1 FROM "HealthyAdultPhrase");',
    '',
  ].join('\n');

describe('check-pool-sync.mjs', () => {
  it('фраза из data.ts подкреплена сидом — гейт зелёный', () => {
    const res = runGate('check-pool-sync.mjs', {
      'src/bot/healthy-adult.data.ts': dataTs(['Раз', 'Два']),
      'prisma/migrations/20260101000000_seed/migration.sql': seedMigration([
        ['Раз', 0],
        ['Два', 1],
      ]),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Пул синхронизирован');
  });

  it('фраза в data.ts правлена без сопровождающей миграции — exit 1, фраза в stderr', () => {
    const res = runGate('check-pool-sync.mjs', {
      'src/bot/healthy-adult.data.ts': dataTs(['Раз', 'Два-переписано']),
      'prisma/migrations/20260101000000_seed/migration.sql': seedMigration([
        ['Раз', 0],
        ['Два', 1],
      ]),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('разошёлся');
    expect(res.stderr).toContain('Два-переписано');
  });

  it('UPDATE-миграция досинхронизирует пул — гейт зелёный', () => {
    const updateMigration = [
      'UPDATE "HealthyAdultPhrase" SET "text" = \'Два-переписано\', "updatedAt" = CURRENT_TIMESTAMP',
      ' WHERE "text" = \'Два\';',
      '',
    ].join('\n');
    const res = runGate('check-pool-sync.mjs', {
      'src/bot/healthy-adult.data.ts': dataTs(['Раз', 'Два-переписано']),
      'prisma/migrations/20260101000000_seed/migration.sql': seedMigration([
        ['Раз', 0],
        ['Два', 1],
      ]),
      'prisma/migrations/20260102000000_fix/migration.sql': updateMigration,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Пул синхронизирован');
  });

  it('DELETE-миграция убирает фразу из пула — data.ts без неё всё ещё зелёный', () => {
    const deleteMigration = [
      'DELETE FROM "HealthyAdultPhrase" WHERE "text" IN (',
      "  'Два'",
      ');',
      '',
    ].join('\n');
    const res = runGate('check-pool-sync.mjs', {
      'src/bot/healthy-adult.data.ts': dataTs(['Раз']),
      'prisma/migrations/20260101000000_seed/migration.sql': seedMigration([
        ['Раз', 0],
        ['Два', 1],
      ]),
      'prisma/migrations/20260102000000_del/migration.sql': deleteMigration,
    });
    expect(res.status).toBe(0);
  });

  it('миграции применяются в хронологическом порядке каталогов (более ранний UPDATE не должен победить более поздний)', () => {
    const older = [
      'UPDATE "HealthyAdultPhrase" SET "text" = \'Промежуточная\', "updatedAt" = CURRENT_TIMESTAMP',
      ' WHERE "text" = \'Раз\';',
      '',
    ].join('\n');
    const newer = [
      'UPDATE "HealthyAdultPhrase" SET "text" = \'Финальная\', "updatedAt" = CURRENT_TIMESTAMP',
      ' WHERE "text" = \'Промежуточная\';',
      '',
    ].join('\n');
    const res = runGate('check-pool-sync.mjs', {
      'src/bot/healthy-adult.data.ts': dataTs(['Финальная']),
      'prisma/migrations/20260101000000_seed/migration.sql': seedMigration([['Раз', 0]]),
      'prisma/migrations/20260102000000_a/migration.sql': older,
      'prisma/migrations/20260103000000_b/migration.sql': newer,
    });
    expect(res.status).toBe(0);
  });

  it('апостроф внутри фразы (TS \\\' и SQL \'\') переживает реконструкцию', () => {
    const phrase = "Строка с апострофом ' внутри";
    const res = runGate('check-pool-sync.mjs', {
      'src/bot/healthy-adult.data.ts': dataTs([phrase]),
      'prisma/migrations/20260101000000_seed/migration.sql': seedMigration([[phrase, 0]]),
    });
    expect(res.status).toBe(0);
  });
});
