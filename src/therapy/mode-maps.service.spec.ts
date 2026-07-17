// Тесты на ModeMapsService: CRUD карт режимов и кастомных режимов
// терапевта. Access-control по mapId (getModeMap/updateModeMap/
// deleteModeMap + клиентский read-only доступ) — в mode-maps.access.spec.ts
// (файл разделён из-за лимита ~300 строк/файл, CLAUDE.md).
import { ModeMapsService } from './mode-maps.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';

function makeDb(rels: Rel[], maps: any[] = [], customModes: any[] = []) {
  const relBase = makeRelationPrismaMock(rels);
  let mapAutoId = maps.length ? Math.max(...maps.map((m) => m.id)) + 1 : 1;
  let modeAutoId = customModes.length
    ? Math.max(...customModes.map((m) => m.id)) + 1
    : 1;
  const matchMap = (m: any, where: any) =>
    (where.id === undefined || m.id === where.id) &&
    (where.therapistId === undefined || m.therapistId === where.therapistId) &&
    (where.clientId === undefined || m.clientId === where.clientId);
  const db: any = {
    ...relBase,
    modeMap: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(maps.filter((m) => matchMap(m, where))),
      ),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(maps.find((m) => m.id === where.id) ?? null),
      ),
      create: jest.fn(({ data }: any) => {
        const row = {
          id: mapAutoId++,
          nodes: [],
          edges: [],
          createdAt: new Date('2026-07-01T00:00:00Z'),
          updatedAt: new Date('2026-07-01T00:00:00Z'),
          ...data,
        };
        maps.push(row);
        return Promise.resolve(row);
      }),
    },
    therapistCustomMode: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          customModes.filter((m) => m.therapistId === where.therapistId),
        ),
      ),
      create: jest.fn(({ data }: any) => {
        const row = { id: modeAutoId++, createdAt: new Date(), ...data };
        customModes.push(row);
        return Promise.resolve(row);
      }),
      deleteMany: jest.fn(({ where }: any) => {
        const before = customModes.length;
        for (let i = customModes.length - 1; i >= 0; i--) {
          const m = customModes[i];
          if (
            (where.id === undefined || m.id === where.id) &&
            (where.therapistId === undefined ||
              m.therapistId === where.therapistId)
          )
            customModes.splice(i, 1);
        }
        return Promise.resolve({ count: before - customModes.length });
      }),
    },
  };
  return db;
}

function makeService(rels: Rel[], maps: any[] = [], customModes: any[] = []) {
  const db = makeDb(rels, maps, customModes);
  const relationsService = new TherapyRelationsService(db, {} as any);
  const service = new ModeMapsService(db, relationsService);
  return { service, db, maps, customModes };
}

const T1 = 100n; // терапевт-владелец
const T2 = 200n; // чужой терапевт
const CLIENT_A = 555n;
const CLIENT_B = 777n;
const relA: Rel = {
  id: 1,
  therapistId: T1,
  clientId: CLIENT_A,
  status: 'active',
  code: 'AAA111',
};
const relB: Rel = {
  id: 2,
  therapistId: T1,
  clientId: CLIENT_B,
  status: 'active',
  code: 'BBB222',
};

describe('ModeMapsService — listModeMaps/createModeMap требуют активную связь', () => {
  it('listModeMaps: чужой терапевт без связи с клиентом — отказ', async () => {
    const { service } = makeService([relA]);
    await expect(service.listModeMaps(T2, Number(CLIENT_A))).rejects.toThrow(
      'No active relation',
    );
  });

  it('createModeMap: без активной связи — отказ, карта не создаётся', async () => {
    const { service, maps } = makeService([relA]);
    await expect(
      service.createModeMap(T2, Number(CLIENT_A), 'Карта'),
    ).rejects.toThrow('No active relation');
    expect(maps).toHaveLength(0);
  });

  it('createModeMap: с активной связью создаёт карту с пустыми nodes/edges и валидным kind', async () => {
    const { service, maps } = makeService([relA]);
    const map = await service.createModeMap(
      T1,
      Number(CLIENT_A),
      'Карта Ани',
      'couple',
    );
    expect(map.title).toBe('Карта Ани');
    expect(map.kind).toBe('couple');
    expect(map.nodes).toEqual([]);
    expect(map.edges).toEqual([]);
    expect(maps).toHaveLength(1);
  });

  it('createModeMap: неизвестный kind подменяется на "problem"', async () => {
    const { service } = makeService([relA]);
    const map = await service.createModeMap(T1, Number(CLIENT_A), 'X', 'bogus');
    expect(map.kind).toBe('problem');
  });

  it('listModeMaps: изоляция — карты клиента A не попадают в список клиента B', async () => {
    const { service, maps } = makeService([relA, relB]);
    maps.push(
      {
        id: 1,
        therapistId: T1,
        clientId: CLIENT_A,
        title: 'A',
        kind: 'problem',
        nodes: [],
        edges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        therapistId: T1,
        clientId: CLIENT_B,
        title: 'B',
        kind: 'problem',
        nodes: [],
        edges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    const listA = await service.listModeMaps(T1, Number(CLIENT_A));
    const listB = await service.listModeMaps(T1, Number(CLIENT_B));
    expect(listA.map((m: any) => m.title)).toEqual(['A']);
    expect(listB.map((m: any) => m.title)).toEqual(['B']);
  });
});

describe('ModeMapsService — кастомные режимы терапевта', () => {
  it('createCustomMode: неизвестный nodeType подменяется на "custom", имя обрезается до 80 символов, emoji — до 8', async () => {
    const { service, customModes } = makeService([]);
    const longName = 'а'.repeat(100);
    const mode = await service.createCustomMode(T1, {
      name: longName,
      emoji: '🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥',
      nodeType: 'bogus',
    });
    expect(mode.nodeType).toBe('custom');
    expect(mode.name).toHaveLength(80);
    expect(customModes[0].emoji.length).toBeLessThanOrEqual(8);
  });

  it('createCustomMode: emoji по умолчанию "⬡", если не передан', async () => {
    const { service } = makeService([]);
    const mode = await service.createCustomMode(T1, { name: 'Критик' });
    expect(mode.emoji).toBe('⬡');
  });

  it('listCustomModes: изоляция — режимы чужого терапевта не попадают в список', async () => {
    const { service, customModes } = makeService([]);
    customModes.push(
      {
        id: 1,
        therapistId: T1,
        name: 'Мой',
        emoji: '⬡',
        nodeType: 'custom',
        createdAt: new Date(),
      },
      {
        id: 2,
        therapistId: T2,
        name: 'Чужой',
        emoji: '⬡',
        nodeType: 'custom',
        createdAt: new Date(),
      },
    );
    const mine = await service.listCustomModes(T1);
    expect(mine.map((m: any) => m.name)).toEqual(['Мой']);
  });

  it('deleteCustomMode: deleteMany скоупится по therapistId — чужой терапевт не удаляет и не выбрасывает (тихий no-op)', async () => {
    const { service, customModes } = makeService([]);
    customModes.push({
      id: 5,
      therapistId: T1,
      name: 'Мой критик',
      emoji: '⬡',
      nodeType: 'custom',
      createdAt: new Date(),
    });
    await expect(service.deleteCustomMode(T2, 5)).resolves.toBeUndefined();
    expect(customModes).toHaveLength(1); // цел — чужой не мог удалить

    await service.deleteCustomMode(T1, 5);
    expect(customModes).toHaveLength(0);
  });
});
