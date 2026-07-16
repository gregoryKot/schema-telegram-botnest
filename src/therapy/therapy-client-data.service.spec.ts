// Регрессия privacy-бага (аудит 2026-07, свип дублей): маршрут
// GET /api/therapy/client/:id/{schema,mode}-notes существовал в ДВУХ
// контроллерах с разными реализациями — отвечала та, что игнорировала
// настройку клиента therapistShareCards. Дубль удалён, проверка перенесена
// в единственную реализацию. Инвариант: закрытые карточки → пусто.
import { TherapyClientDataService } from './therapy-client-data.service';

function makeService(opts: {
  shareCards?: boolean | null;
  hasRelation?: boolean;
  notes?: Array<Record<string, unknown>>;
}) {
  const prisma: any = {
    user: {
      findUnique: jest.fn(() => ({
        therapistShareCards: opts.shareCards ?? true,
      })),
    },
    userSchemaNote: {
      findMany: jest.fn(() => opts.notes ?? []),
    },
    userModeNote: {
      findMany: jest.fn(() => opts.notes ?? []),
    },
  };
  const relations: any = {
    assertHasClient: jest.fn(() => {
      if (opts.hasRelation === false) throw new Error('No active relation');
    }),
  };
  const service = new TherapyClientDataService(
    prisma,
    {} as any,
    {} as any,
    relations,
  );
  return { service, prisma, relations };
}

const NOTE = { schemaId: 'abandonment', triggers: 'plain-текст' };

describe('доступ терапевта к карточкам клиента', () => {
  it('therapistShareCards=false → пусто, сами заметки не читаются', async () => {
    const { service, prisma } = makeService({
      shareCards: false,
      notes: [NOTE],
    });
    expect(await service.getClientSchemaNotes(1n, 2)).toEqual([]);
    expect(await service.getClientModeNotes(1n, 2)).toEqual([]);
    expect(prisma.userSchemaNote.findMany).not.toHaveBeenCalled();
    expect(prisma.userModeNote.findMany).not.toHaveBeenCalled();
  });

  it('therapistShareCards=true/null (дефолт «делюсь») → заметки отдаются', async () => {
    for (const shareCards of [true, null]) {
      const { service } = makeService({ shareCards, notes: [NOTE] });
      const res = await service.getClientSchemaNotes(1n, 2);
      expect(res).toHaveLength(1);
    }
  });

  it('без активной связи — отказ до чтения настроек и заметок', async () => {
    const { service, prisma } = makeService({
      hasRelation: false,
      notes: [NOTE],
    });
    await expect(service.getClientSchemaNotes(1n, 2)).rejects.toThrow(
      'No active relation',
    );
    expect(prisma.userSchemaNote.findMany).not.toHaveBeenCalled();
  });

  it('виртуальный клиент (id<0) → пусто без обращений к БД', async () => {
    const { service, prisma, relations } = makeService({ notes: [NOTE] });
    expect(await service.getClientSchemaNotes(1n, -5)).toEqual([]);
    expect(relations.assertHasClient).not.toHaveBeenCalled();
    expect(prisma.userSchemaNote.findMany).not.toHaveBeenCalled();
  });
});
