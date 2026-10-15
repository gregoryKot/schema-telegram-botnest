// Покрывает getConceptualization (пусто/непусто, decrypt истории) и ветки
// saveConceptualization для schemaIds/modeIds/modeMapNodes/modeMapEdges —
// history-версионирование текстовых полей уже покрыто в
// therapy-notes.service.spec.ts, здесь — массивы, которые до этого теста
// шли отдельным (непокрытым) путём в encryptConceptFields/decryptConceptFields.
// Ниже — связи режимов графической концептуализации (modeLinks): связка
// «сохранил → прочитал», шифрование в «БД», снапшот истории, legacy-строки.
// Те же свойства — для schemaLinks (убеждение, детский опыт, потребности схем).
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';
import { loadWithKeys } from '../test-support/load-with-keys';

function makeService(
  rels: Rel[],
  conceptRow: any = null,
  ServiceCtor: typeof TherapyNotesService = TherapyNotesService,
) {
  const concept = { row: conceptRow };
  const prisma: any = {
    ...makeRelationPrismaMock(rels),
    clientConceptualization: {
      findUnique: jest.fn(async () => concept.row),
      upsert: jest.fn(async ({ create, update }: any) => {
        concept.row = concept.row
          ? { ...concept.row, ...update }
          : { ...create };
        return concept.row;
      }),
    },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const relationsService = new TherapyRelationsService(prisma, {} as any);
  const service = new ServiceCtor(prisma, relationsService);
  return { service, prisma, concept };
}

const T1 = 100n;
const T2 = 200n;
const CLIENT = 555n;

const activeRel: Rel = {
  id: 1,
  therapistId: T1,
  clientId: CLIENT,
  status: 'active',
  code: 'AAA111',
};

describe('TherapyNotesService.getConceptualization', () => {
  it('возвращает null, когда концептуализации ещё нет', async () => {
    const { service } = makeService([activeRel]);
    await expect(service.getConceptualization(T1, CLIENT)).resolves.toBeNull();
  });

  it('чужой терапевт не может прочитать концептуализацию', async () => {
    const { service } = makeService([activeRel]);
    await expect(service.getConceptualization(T2, CLIENT)).rejects.toThrow(
      'No active relation',
    );
  });

  it('сохранённая концептуализация читается назад теми же значениями массивов и текста (read-after-write)', async () => {
    const { service } = makeService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      schemaIds: ['defectiveness', 'abandonment'],
      modeIds: ['vulnerable_child'],
      modeMapNodes: [{ id: 'n1', label: 'Уязвимый ребёнок' }],
      modeMapEdges: [{ from: 'n1', to: 'n2' }],
      goals: 'снизить избегание',
    });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaIds).toEqual(['defectiveness', 'abandonment']);
    expect(loaded!.modeIds).toEqual(['vulnerable_child']);
    expect(loaded!.modeMapNodes).toEqual([
      { id: 'n1', label: 'Уязвимый ребёнок' },
    ]);
    expect(loaded!.modeMapEdges).toEqual([{ from: 'n1', to: 'n2' }]);
    expect(loaded!.goals).toBe('снизить избегание');
    expect(loaded!.history).toEqual([]);
  });

  it('history возвращается расшифрованным по каждому снапшоту', async () => {
    const { service } = makeService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      schemaIds: ['defectiveness'],
      goals: 'v1',
    });
    await service.saveConceptualization(T1, CLIENT, { goals: 'v2' });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.history).toHaveLength(1);
    expect(loaded!.history[0].goals).toBe('v1');
    expect(loaded!.history[0].schemaIds).toEqual(['defectiveness']);
  });
});

// Crypto-модуль разбирает ENCRYPTION_KEY один раз при импорте: без ключа
// encrypt() — identity, и тест «в БД не открытый текст» ничего бы не доказывал.
// Сервис грузится свежей копией модулей под заданным ключом.
function makeKeyedService(rels: Rel[], conceptRow: any = null) {
  const { TherapyNotesService: Keyed } = loadWithKeys(
    { key: 'ab'.repeat(32) },
    () =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./therapy-notes.service') as typeof import('./therapy-notes.service'),
  );
  return makeService(rels, conceptRow, Keyed);
}

const LINKS = [
  {
    modeId: 'punitive_critic',
    alias: 'Судья Анна',
    schemaIds: ['defectiveness', 'unrelenting_standards'],
    needIds: ['safety', 'autonomy'],
    origin: 'Голос отца: «ленивая девчонка»',
    manifest: 'Не отправляет резюме, откладывает до завтра',
    strategy: 'Дать Критику имя и ограничить его время',
  },
  {
    modeId: 'vulnerable_child',
    alias: '',
    schemaIds: [],
    needIds: ['safety'],
    origin: '',
    manifest: '',
    strategy: '',
  },
];

describe('TherapyNotesService.saveConceptualization — modeLinks', () => {
  it('сохранил связи → getConceptualization вернул те же значения (read-after-write)', async () => {
    const { service } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      modeIds: ['punitive_critic', 'vulnerable_child'],
      modeLinks: LINKS,
    });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.modeLinks).toEqual(LINKS);
  });

  it('ответ самого saveConceptualization тоже несёт расшифрованные связи', async () => {
    const { service } = makeKeyedService([activeRel]);
    const saved = await service.saveConceptualization(T1, CLIENT, {
      modeLinks: LINKS,
    });
    expect(saved.modeLinks).toEqual(LINKS);
  });

  it('в «БД» связи лежат шифротекстом: ни origin, ни alias в открытом виде', async () => {
    const { service, concept } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { modeLinks: LINKS });

    const stored = concept.row.modeLinks;
    expect(typeof stored).toBe('string');
    expect(stored).not.toContain('ленивая девчонка');
    expect(stored).not.toContain('Судья Анна');
    expect(stored).not.toContain('резюме');
  });

  it('повторное сохранение без поля modeLinks не стирает связи', async () => {
    const { service, concept } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { modeLinks: LINKS });
    const storedBefore = concept.row.modeLinks;

    await service.saveConceptualization(T1, CLIENT, {
      goals: 'снизить избегание',
    });

    expect(concept.row.modeLinks).toBe(storedBefore);
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.modeLinks).toEqual(LINKS);
    expect(loaded!.goals).toBe('снизить избегание');
  });

  it('modeLinks: [] явно очищает связи (отличается от «поле не пришло»)', async () => {
    const { service } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { modeLinks: LINKS });
    await service.saveConceptualization(T1, CLIENT, { modeLinks: [] });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.modeLinks).toEqual([]);
  });

  it('первое сохранение без modeLinks создаёт строку с пустыми связями', async () => {
    const { service, prisma } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { goals: 'g' });

    expect(
      prisma.clientConceptualization.upsert.mock.calls[0][0].create.modeLinks,
    ).toEqual([]);
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.modeLinks).toEqual([]);
  });

  it('снапшот истории несёт прежние связи шифротекстом и расшифровывает их при чтении', async () => {
    const { service, concept } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { modeLinks: LINKS });
    const v2 = [{ ...LINKS[0], alias: 'Судья, версия 2' }];
    await service.saveConceptualization(T1, CLIENT, { modeLinks: v2 });

    const rawSnapshot = (concept.row.history as any[])[0];
    expect(typeof rawSnapshot.modeLinks).toBe('string');
    expect(rawSnapshot.modeLinks).not.toContain('ленивая девчонка');

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.modeLinks).toEqual(v2);
    expect(loaded!.history).toHaveLength(1);
    expect(loaded!.history[0].modeLinks).toEqual(LINKS);
  });

  it('снапшот строки с ещё пустыми связями читается как []', async () => {
    const { service } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { goals: 'v1' });
    await service.saveConceptualization(T1, CLIENT, { modeLinks: LINKS });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.history[0].modeLinks).toEqual([]);
  });
});

describe('TherapyNotesService.getConceptualization — legacy-строки без modeLinks', () => {
  const legacyRow = (over: Record<string, unknown>) => ({
    id: 1,
    therapistId: T1,
    clientId: CLIENT,
    schemaIds: [],
    modeIds: [],
    history: [],
    ...over,
  });

  it.each([
    ['undefined (колонки в строке нет)', undefined],
    ['null', null],
  ])('modeLinks: %s читается как []', async (_label, value) => {
    const { service } = makeService(
      [activeRel],
      legacyRow({ modeLinks: value }),
    );
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.modeLinks).toEqual([]);
  });

  it('значение по умолчанию колонки ([] массивом, не строкой) возвращается как есть', async () => {
    const { service } = makeService([activeRel], legacyRow({ modeLinks: [] }));
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.modeLinks).toEqual([]);
  });

  it('снапшот истории без поля modeLinks (до фичи) читается как []', async () => {
    const { service } = makeService(
      [activeRel],
      legacyRow({
        history: [
          {
            savedAt: '2026-01-01T00:00:00.000Z',
            schemaIds: ['x'],
            goals: 'old',
          },
        ],
      }),
    );
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.history[0].modeLinks).toEqual([]);
    expect(loaded!.history[0].goals).toBe('old');
  });

  it('нечитаемое значение в modeLinks не роняет чтение — пустой массив', async () => {
    const { service } = makeKeyedService(
      [activeRel],
      legacyRow({ modeLinks: 'enc:v1:not-a-real-ciphertext' }),
    );
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.modeLinks).toEqual([]);
  });
});

const SCHEMA_LINKS = [
  {
    schemaId: 'defectiveness',
    belief: 'Со мной что-то не так, если узнают, отвернутся',
    origin: 'Мать сравнивала с сестрой: «у Лены получилось бы лучше»',
    needIds: ['safety', 'autonomy'],
  },
  { schemaId: 'abandonment', belief: '', origin: '', needIds: [] },
];

describe('TherapyNotesService.saveConceptualization — schemaLinks', () => {
  it('сохранил тексты схем → getConceptualization вернул те же значения (read-after-write)', async () => {
    const { service } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      schemaIds: ['defectiveness', 'abandonment'],
      schemaLinks: SCHEMA_LINKS,
    });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual(SCHEMA_LINKS);
  });

  it('ответ самого saveConceptualization тоже несёт расшифрованные тексты схем', async () => {
    const { service } = makeKeyedService([activeRel]);
    const saved = await service.saveConceptualization(T1, CLIENT, {
      schemaLinks: SCHEMA_LINKS,
    });
    expect(saved.schemaLinks).toEqual(SCHEMA_LINKS);
  });

  it('в «БД» тексты схем лежат шифротекстом: ни убеждения, ни детского опыта в открытом виде', async () => {
    const { service, concept } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      schemaLinks: SCHEMA_LINKS,
    });

    const stored = concept.row.schemaLinks;
    expect(typeof stored).toBe('string');
    expect(stored).not.toContain('отвернутся');
    expect(stored).not.toContain('сестрой');
  });

  it('повторное сохранение без поля schemaLinks не стирает тексты схем', async () => {
    const { service, concept } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      schemaLinks: SCHEMA_LINKS,
    });
    const storedBefore = concept.row.schemaLinks;

    await service.saveConceptualization(T1, CLIENT, { goals: 'g' });

    expect(concept.row.schemaLinks).toBe(storedBefore);
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual(SCHEMA_LINKS);
  });

  it('сохранение одних modeLinks не трогает schemaLinks, и наоборот', async () => {
    const { service } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      schemaLinks: SCHEMA_LINKS,
    });
    await service.saveConceptualization(T1, CLIENT, { modeLinks: LINKS });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual(SCHEMA_LINKS);
    expect(loaded!.modeLinks).toEqual(LINKS);
  });

  it('schemaLinks: [] явно очищает тексты (отличается от «поле не пришло»)', async () => {
    const { service } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      schemaLinks: SCHEMA_LINKS,
    });
    await service.saveConceptualization(T1, CLIENT, { schemaLinks: [] });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual([]);
  });

  it('первое сохранение без schemaLinks создаёт строку с пустыми текстами схем', async () => {
    const { service, prisma } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { goals: 'g' });

    expect(
      prisma.clientConceptualization.upsert.mock.calls[0][0].create.schemaLinks,
    ).toEqual([]);
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual([]);
  });

  it('снапшот истории несёт прежние тексты схем шифротекстом и расшифровывает их при чтении', async () => {
    const { service, concept } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      schemaLinks: SCHEMA_LINKS,
    });
    const v2 = [{ ...SCHEMA_LINKS[0], belief: 'Версия 2' }];
    await service.saveConceptualization(T1, CLIENT, { schemaLinks: v2 });

    const rawSnapshot = (concept.row.history as any[])[0];
    expect(typeof rawSnapshot.schemaLinks).toBe('string');
    expect(rawSnapshot.schemaLinks).not.toContain('отвернутся');

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual(v2);
    expect(loaded!.history).toHaveLength(1);
    expect(loaded!.history[0].schemaLinks).toEqual(SCHEMA_LINKS);
  });

  it('снапшот строки с ещё пустыми текстами схем читается как []', async () => {
    const { service } = makeKeyedService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { goals: 'v1' });
    await service.saveConceptualization(T1, CLIENT, {
      schemaLinks: SCHEMA_LINKS,
    });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.history[0].schemaLinks).toEqual([]);
  });
});

describe('TherapyNotesService.getConceptualization — legacy-строки без schemaLinks', () => {
  const legacyRow = (over: Record<string, unknown>) => ({
    id: 1,
    therapistId: T1,
    clientId: CLIENT,
    schemaIds: [],
    modeIds: [],
    history: [],
    ...over,
  });

  it.each([
    ['undefined (колонки в строке нет)', undefined],
    ['null', null],
  ])('schemaLinks: %s читается как []', async (_label, value) => {
    const { service } = makeService(
      [activeRel],
      legacyRow({ schemaLinks: value }),
    );
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual([]);
  });

  it('значение по умолчанию колонки ([] массивом, не строкой) возвращается как есть', async () => {
    const { service } = makeService(
      [activeRel],
      legacyRow({ schemaLinks: [] }),
    );
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual([]);
  });

  it('снапшот истории без поля schemaLinks (до фичи) читается как []', async () => {
    const { service } = makeService(
      [activeRel],
      legacyRow({
        history: [
          {
            savedAt: '2026-01-01T00:00:00.000Z',
            schemaIds: ['x'],
            goals: 'old',
          },
        ],
      }),
    );
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.history[0].schemaLinks).toEqual([]);
    expect(loaded!.history[0].goals).toBe('old');
  });

  it('нечитаемое значение в schemaLinks не роняет чтение — пустой массив', async () => {
    const { service } = makeKeyedService(
      [activeRel],
      legacyRow({ schemaLinks: 'enc:v1:not-a-real-ciphertext' }),
    );
    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.schemaLinks).toEqual([]);
  });
});
