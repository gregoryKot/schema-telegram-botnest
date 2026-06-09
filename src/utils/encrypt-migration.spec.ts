// encrypt() кеширует ключ при импорте crypto, поэтому грузим модуль заново с ENCRYPTION_KEY.
const KEY = 'a'.repeat(64);

function load(key: string | null) {
  jest.resetModules();
  if (key) process.env.ENCRYPTION_KEY = key;
  else delete process.env.ENCRYPTION_KEY;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mig = require('./encrypt-migration');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('./crypto');
  return { migrateClinicalLabels: mig.migrateClinicalLabels as (p: any) => Promise<void>, crypto };
}

function makePrisma() {
  const model = () => ({ findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) });
  return {
    note: model(), user: model(), schemaDiaryEntry: model(),
    modeDiaryEntry: model(), clientConceptualization: model(),
  } as any;
}

describe('migrateClinicalLabels', () => {
  const ORIG = process.env.ENCRYPTION_KEY;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = ORIG;
  });

  it('без ENCRYPTION_KEY — выходит сразу, БД не трогает', async () => {
    const { migrateClinicalLabels } = load(null);
    const prisma = makePrisma();
    await migrateClinicalLabels(prisma);
    expect(prisma.note.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('Note.tags: шифрует плейнтекст, пропускает уже зашифрованное', async () => {
    const { migrateClinicalLabels, crypto } = load(KEY);
    const prisma = makePrisma();
    prisma.note.findMany.mockResolvedValue([
      { id: 1, tags: 'депрессия,тревога' },         // плейнтекст → шифруем
      { id: 2, tags: crypto.encrypt('уже')! },       // уже зашифровано → скип
    ]);
    await migrateClinicalLabels(prisma);
    expect(prisma.note.update).toHaveBeenCalledTimes(1);
    expect(prisma.note.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
  });

  it('User: шифрует массивы mySchemaIds/myModeIds, строки пропускает', async () => {
    const { migrateClinicalLabels, crypto } = load(KEY);
    const prisma = makePrisma();
    prisma.user.findMany.mockResolvedValue([
      { id: 5n, mySchemaIds: ['ed'], myModeIds: ['vc'] },          // массивы → шифруем
      { id: 6n, mySchemaIds: crypto.encrypt('[]'), myModeIds: crypto.encrypt('[]') }, // строки → скип
    ]);
    await migrateClinicalLabels(prisma);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const call = prisma.user.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 5n });
    expect(typeof call.data.mySchemaIds).toBe('string');
    expect(typeof call.data.myModeIds).toBe('string');
  });

  it('SchemaDiaryEntry: массив schemaIds → шифруем, строку → скип', async () => {
    const { migrateClinicalLabels } = load(KEY);
    const prisma = makePrisma();
    prisma.schemaDiaryEntry.findMany.mockResolvedValue([
      { id: 1, schemaIds: ['ed', 'ab'] },
      { id: 2, schemaIds: 'уже-строка' },
    ]);
    await migrateClinicalLabels(prisma);
    expect(prisma.schemaDiaryEntry.update).toHaveBeenCalledTimes(1);
  });

  it('ModeDiaryEntry: плейнтекст modeId → шифруем', async () => {
    const { migrateClinicalLabels, crypto } = load(KEY);
    const prisma = makePrisma();
    prisma.modeDiaryEntry.findMany.mockResolvedValue([
      { id: 1, modeId: 'angry-child' },
      { id: 2, modeId: crypto.encrypt('healthy-adult')! },
    ]);
    await migrateClinicalLabels(prisma);
    expect(prisma.modeDiaryEntry.update).toHaveBeenCalledTimes(1);
    expect(prisma.modeDiaryEntry.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
  });

  it('ClientConceptualization: шифрует schemaIds/modeIds и снапшоты history', async () => {
    const { migrateClinicalLabels } = load(KEY);
    const prisma = makePrisma();
    prisma.clientConceptualization.findMany.mockResolvedValue([
      { id: 1, schemaIds: ['ed'], modeIds: ['vc'], history: [{ schemaIds: ['ab'], modeIds: ['hc'], note: 'x' }] },
    ]);
    await migrateClinicalLabels(prisma);
    expect(prisma.clientConceptualization.update).toHaveBeenCalledTimes(1);
    const data = prisma.clientConceptualization.update.mock.calls[0][0].data;
    expect(typeof data.schemaIds).toBe('string');
    expect(Array.isArray(data.history)).toBe(true);
    expect(typeof data.history[0].schemaIds).toBe('string'); // снапшот тоже зашифрован
  });

  it('идемпотентность: всё уже зашифровано → ни одного update', async () => {
    const { migrateClinicalLabels, crypto } = load(KEY);
    const prisma = makePrisma();
    prisma.note.findMany.mockResolvedValue([{ id: 1, tags: crypto.encrypt('t')! }]);
    prisma.user.findMany.mockResolvedValue([{ id: 5n, mySchemaIds: crypto.encrypt('[]'), myModeIds: crypto.encrypt('[]') }]);
    prisma.schemaDiaryEntry.findMany.mockResolvedValue([{ id: 1, schemaIds: 'enc' }]);
    prisma.modeDiaryEntry.findMany.mockResolvedValue([{ id: 1, modeId: crypto.encrypt('m')! }]);
    prisma.clientConceptualization.findMany.mockResolvedValue([{ id: 1, schemaIds: 'enc', modeIds: 'enc', history: [] }]);
    await migrateClinicalLabels(prisma);
    expect(prisma.note.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.schemaDiaryEntry.update).not.toHaveBeenCalled();
    expect(prisma.modeDiaryEntry.update).not.toHaveBeenCalled();
    expect(prisma.clientConceptualization.update).not.toHaveBeenCalled();
  });
});
