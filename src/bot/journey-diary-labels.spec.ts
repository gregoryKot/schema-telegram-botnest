import { loadWithKeys } from '../test-support/load-with-keys';
import {
  createFakeTable,
  type FakeTable,
} from '../test-support/fake-prisma.spec-helper';

// «Мой путь» ↔ шифрование меток дневников, с НАСТОЯЩИМ ключом. Дневник пишет
// modeId и schemaIds шифротекстом (diary.service.ts), лента читала их сырыми:
// фронт получал шифротекст вместо id режима и `[]` вместо схем — у записей
// дневников в ленте пропадал подзаголовок. journey.service.spec.ts этого не
// видел: без ENCRYPTION_KEY encrypt() — passthrough. Здесь — связка
// «сохранил через дневник → нашёл в ленте» плюс легаси-строки и чужой ключ.

/* eslint-disable @typescript-eslint/no-require-imports */
const load = (key: string) =>
  loadWithKeys({ key }, () => ({
    crypto: require('../utils/crypto') as typeof import('../utils/crypto'),
    diary: require('./diary.service') as typeof import('./diary.service'),
    journey: require('./journey.service') as typeof import('./journey.service'),
    labels:
      require('./journey-diary-labels') as typeof import('./journey-diary-labels'),
  }));
/* eslint-enable @typescript-eslint/no-require-imports */

const mods = load('a7'.repeat(32));
const foreign = load('b8'.repeat(32));
const USER = 7n;

function makePrisma() {
  const table = (): FakeTable =>
    createFakeTable([], {
      defaults: () => ({ userId: USER, createdAt: new Date() }),
    });
  const none = { findMany: async () => [], count: async () => 0 };
  const tables = { schemaDiaryEntry: table(), modeDiaryEntry: table() };
  const prisma = {
    ...tables,
    rating: { groupBy: async () => [] },
    note: none,
    gratitudeDiaryEntry: none,
    userPractice: none,
    practicePlan: none,
    ysqResultHistory: none,
    ysqResult: { findUnique: async () => null },
    childhoodRating: none,
    userBeliefCheck: none,
    userLetter: none,
    userFlashcard: none,
    userSafePlace: { findUnique: async () => null },
    userSchemaNote: none,
    userModeNote: none,
    practiceSession: { findMany: async () => [], groupBy: async () => [] },
  };
  return { tables, db: prisma as never };
}

describe('«Мой путь»: метки дневников зашифрованы при записи', () => {
  it('запись дневника схем и режимов → в ленте открытые id', async () => {
    const { tables, db } = makePrisma();
    const diary = new mods.diary.DiaryService(db);
    await diary.createSchemaDiaryEntry(USER, {
      trigger: 'начальник повысил голос',
      emotions: [{ id: 'fear', intensity: 4 }],
      schemaIds: ['abandonment', 'defectiveness'],
    });
    await diary.createModeDiaryEntry(USER, {
      modeId: 'vulnerable_child',
      situation: 'не ответили на сообщение',
    });
    // Контроль: в таблице действительно шифротекст, иначе тест ничего не доказывает.
    const stored = [
      tables.schemaDiaryEntry._rows[0].schemaIds,
      tables.modeDiaryEntry._rows[0].modeId,
    ] as string[];
    expect(stored.map((v) => mods.crypto.tryDecrypt(v).ok)).toEqual([
      true,
      true,
    ]);

    const { items } = await new mods.journey.JourneyService(db).getJourney(
      USER,
    );
    const byType = (t: string) => items.find((i) => i.type === t);
    expect(byType('schema_diary')?.schemaIds).toEqual([
      'abandonment',
      'defectiveness',
    ]);
    expect(byType('mode_diary')?.modeId).toBe('vulnerable_child');
  });
});

describe('journey-diary-labels: легаси и нечитаемое', () => {
  const { modeDiaryLabel, schemaDiaryLabels } = mods.labels;

  it('легаси открытым текстом и Json-массивом читается как есть', () => {
    expect(modeDiaryLabel({ modeId: 'angry_child' })).toBe('angry_child');
    expect(schemaDiaryLabels({ schemaIds: ['mistrust', 3] })).toEqual([
      'mistrust',
    ]);
    expect(schemaDiaryLabels({ schemaIds: '["mistrust"]' })).toEqual([
      'mistrust',
    ]);
  });

  it('шифротекст чужим ключом → нет метки, шифротекст наружу не уходит', () => {
    const modeId = foreign.crypto.encrypt('vulnerable_child') as string;
    const schemaIds = foreign.crypto.encryptJson(['abandonment']);
    expect(modeDiaryLabel({ modeId })).toBeUndefined();
    expect(schemaDiaryLabels({ schemaIds })).toEqual([]);
  });
});
