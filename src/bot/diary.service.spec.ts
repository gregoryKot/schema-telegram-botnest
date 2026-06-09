import { DiaryService } from './diary.service';

function makePrisma() {
  const model = () => ({
    create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data })),
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 1, ...create })),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  });
  return { schemaDiaryEntry: model(), modeDiaryEntry: model(), gratitudeDiaryEntry: model() } as any;
}

describe('DiaryService — Schema Diary', () => {
  it('createSchemaDiaryEntry шифрует и возвращает плейнтекст', async () => {
    const prisma = makePrisma();
    const out = await new DiaryService(prisma).createSchemaDiaryEntry(1n, {
      trigger: 'ссора', emotions: [{ id: 'fear', intensity: 4 }], thoughts: 'мысль', schemaIds: ['ed', 'ab'],
    });
    expect(prisma.schemaDiaryEntry.create).toHaveBeenCalled();
    const data = prisma.schemaDiaryEntry.create.mock.calls[0][0].data;
    expect(typeof data.emotions).toBe('string');   // emotions сериализованы
    expect(typeof data.schemaIds).toBe('string');   // клинические метки — строка
    // Возвращается плейнтекст, не шифр
    expect(out.trigger).toBe('ссора');
    expect(out.emotions).toEqual([{ id: 'fear', intensity: 4 }]);
  });

  it('getSchemaDiaryEntries расшифровывает; schemaIds-строку парсит', async () => {
    const prisma = makePrisma();
    prisma.schemaDiaryEntry.findMany.mockResolvedValue([
      { id: 1, trigger: 'тригер', emotions: JSON.stringify([{ id: 'sad', intensity: 2 }]),
        thoughts: 'т', schemaIds: JSON.stringify(['ed']), schemaOrigin: null },
    ]);
    const [e] = await new DiaryService(prisma).getSchemaDiaryEntries(1n);
    expect(e.trigger).toBe('тригер');
    expect(e.emotions).toEqual([{ id: 'sad', intensity: 2 }]);
    expect(e.schemaIds).toEqual(['ed']);
  });

  it('getSchemaDiaryEntries: legacy schemaIds-массив возвращается как есть', async () => {
    const prisma = makePrisma();
    prisma.schemaDiaryEntry.findMany.mockResolvedValue([
      { id: 1, trigger: 't', emotions: JSON.stringify([]), schemaIds: ['ed', 'ab'] },
    ]);
    const [e] = await new DiaryService(prisma).getSchemaDiaryEntries(1n);
    expect(e.schemaIds).toEqual(['ed', 'ab']);
  });

  it('deleteSchemaDiaryEntry ограничен по userId', async () => {
    const prisma = makePrisma();
    await new DiaryService(prisma).deleteSchemaDiaryEntry(1n, 99);
    expect(prisma.schemaDiaryEntry.deleteMany).toHaveBeenCalledWith({ where: { id: 99, userId: 1n } });
  });
});

describe('DiaryService — Mode Diary', () => {
  it('createModeDiaryEntry шифрует modeId/situation, возвращает плейнтекст', async () => {
    const prisma = makePrisma();
    const out = await new DiaryService(prisma).createModeDiaryEntry(1n, { modeId: 'angry-child', situation: 'кофе' });
    expect(prisma.modeDiaryEntry.create).toHaveBeenCalled();
    expect(out.situation).toBe('кофе');
  });

  it('getModeDiaryEntries расшифровывает поля', async () => {
    const prisma = makePrisma();
    prisma.modeDiaryEntry.findMany.mockResolvedValue([{ id: 1, modeId: 'hc', situation: 'с', thoughts: null }]);
    const [e] = await new DiaryService(prisma).getModeDiaryEntries(1n);
    expect(e.modeId).toBe('hc');
    expect(e.situation).toBe('с');
  });

  it('deleteModeDiaryEntry ограничен по userId', async () => {
    const prisma = makePrisma();
    await new DiaryService(prisma).deleteModeDiaryEntry(1n, 5);
    expect(prisma.modeDiaryEntry.deleteMany).toHaveBeenCalledWith({ where: { id: 5, userId: 1n } });
  });
});

describe('DiaryService — Gratitude Diary', () => {
  it('upsertGratitudeDiaryEntry сериализует items, возвращает плейнтекст', async () => {
    const prisma = makePrisma();
    const out = await new DiaryService(prisma).upsertGratitudeDiaryEntry(1n, '2026-06-08', ['семья', 'кот']);
    const data = prisma.gratitudeDiaryEntry.upsert.mock.calls[0][0];
    expect(typeof data.create.items).toBe('string');
    expect(out.items).toEqual(['семья', 'кот']);
  });

  it('getGratitudeDiaryEntries парсит items', async () => {
    const prisma = makePrisma();
    prisma.gratitudeDiaryEntry.findMany.mockResolvedValue([{ id: 1, date: '2026-06-08', items: JSON.stringify(['a']) }]);
    const [e] = await new DiaryService(prisma).getGratitudeDiaryEntries(1n);
    expect(e.items).toEqual(['a']);
  });

  it('deleteGratitudeDiaryEntry ограничен по userId', async () => {
    const prisma = makePrisma();
    await new DiaryService(prisma).deleteGratitudeDiaryEntry(1n, 3);
    expect(prisma.gratitudeDiaryEntry.deleteMany).toHaveBeenCalledWith({ where: { id: 3, userId: 1n } });
  });
});
