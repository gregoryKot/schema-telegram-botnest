// Access-control для ModeMapsService по mapId: getModeMap/updateModeMap/
// deleteModeMap + клиентский read-only доступ (listMyModeMaps/getMyModeMap).
// Вынесено из mode-maps.service.spec.ts (лимит ~300 строк/файл, CLAUDE.md).
//
// Было (находка отчёта, аудит): getModeMap/updateModeMap/deleteModeMap
// сверяли ТОЛЬКО therapistId на самой строке ModeMap — без assertHasClient.
// Если связь с клиентом рвалась, терапевт всё ещё мог читать/править/
// удалять ранее созданную карту по mapId, в отличие от всей остальной
// клинической поверхности (TherapyClientDataService, где assertHasClient
// дёргается на каждом обращении, а не только на листинге).
//
// Стало (фикс): все три метода теперь ДОГОНЯЮТ проверку активности связи
// через relationsService.assertHasClient(therapistId, row.clientId) ПОСЛЕ
// проверки ownership по строке (defense in depth — двойной барьер, как и
// раньше первым идёт "это вообще моя карта", затем "а связь ещё активна").
import { ModeMapsService } from './mode-maps.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';
import { encrypt } from '../utils/crypto';

function makeDb(rels: Rel[], maps: any[] = []) {
  const relBase = makeRelationPrismaMock(rels);
  const db: any = {
    ...relBase,
    modeMap: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(maps.find((m) => m.id === where.id) ?? null),
      ),
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          maps.filter(
            (m) =>
              (where.clientId === undefined || m.clientId === where.clientId) &&
              (where.therapistId === undefined ||
                m.therapistId === where.therapistId),
          ),
        ),
      ),
      update: jest.fn(({ where, data }: any) => {
        const row = maps.find((m) => m.id === where.id);
        Object.assign(row, data, {
          updatedAt: new Date('2026-07-02T00:00:00Z'),
        });
        return Promise.resolve(row);
      }),
      delete: jest.fn(({ where }: any) => {
        const idx = maps.findIndex((m) => m.id === where.id);
        const [row] = maps.splice(idx, 1);
        return Promise.resolve(row);
      }),
    },
  };
  return db;
}

function makeService(rels: Rel[], maps: any[] = []) {
  const db = makeDb(rels, maps);
  const relationsService = new TherapyRelationsService(db, {} as any);
  const service = new ModeMapsService(db, relationsService);
  return { service, db, maps };
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

const mkMap = (id: number, title: string, over: any = {}) => ({
  id,
  therapistId: T1,
  clientId: CLIENT_A,
  title,
  kind: 'problem',
  nodes: [],
  edges: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe('ModeMapsService — ownership по строке (защита в глубину №1)', () => {
  it('getModeMap: чужой терапевт получает "Not found"; владелец с активной связью — расшифрованную карту', async () => {
    const { service, maps } = makeService([relA]);
    maps.push(mkMap(10, encrypt('Секретная карта') ?? 'Секретная карта'));
    await expect(service.getModeMap(T2, 10)).rejects.toThrow('Not found');
    const own = await service.getModeMap(T1, 10);
    expect(own.title).toBe('Секретная карта');
  });

  it('updateModeMap: чужой терапевт отклонён без изменения строки; владелец с активной связью — обновляет', async () => {
    const { service, maps } = makeService([relA]);
    maps.push(mkMap(11, 'Старое'));
    await expect(
      service.updateModeMap(T2, 11, { title: 'Взлом' }),
    ).rejects.toThrow('Not found');
    expect(maps[0].title).toBe('Старое');

    const updated = await service.updateModeMap(T1, 11, {
      title: 'Новое',
      nodes: [{ id: 'n1', type: 'trigger' }],
      edges: [{ from: 'n1', to: 'n2' }],
    });
    expect(updated.title).toBe('Новое');
    expect(updated.nodes).toEqual([{ id: 'n1', type: 'trigger' }]);
    expect(updated.edges).toEqual([{ from: 'n1', to: 'n2' }]);
  });

  it('deleteModeMap: чужой терапевт получает "Not found" и карта остаётся; владелец с активной связью — удаляет', async () => {
    const { service, maps } = makeService([relA]);
    maps.push(mkMap(12, 'Карта'));
    await expect(service.deleteModeMap(T2, 12)).rejects.toThrow('Not found');
    expect(maps).toHaveLength(1);
    await service.deleteModeMap(T1, 12);
    expect(maps).toHaveLength(0);
  });
});

describe('ModeMapsService — активность связи (защита в глубину №2, фикс аудита)', () => {
  it('связь разорвана (relation удалена) → get/update/delete отклоняются "No active relation", несмотря на совпадение therapistId на строке', async () => {
    // Связей нет вообще — как после disconnect()/истечения relation.
    const { service, maps } = makeService([]);
    maps.push(mkMap(13, 'Карта после разрыва связи'));

    await expect(service.getModeMap(T1, 13)).rejects.toThrow(
      'No active relation',
    );
    await expect(
      service.updateModeMap(T1, 13, { title: 'Попытка правки' }),
    ).rejects.toThrow('No active relation');
    // Карта не изменилась и не была удалена ни одной из отклонённых попыток.
    expect(maps[0].title).toBe('Карта после разрыва связи');
    await expect(service.deleteModeMap(T1, 13)).rejects.toThrow(
      'No active relation',
    );
    expect(maps).toHaveLength(1);
  });

  it('pending-связь (клиент ещё не подтвердил) тоже не даёт доступа к уже существующей карте', async () => {
    const { service, maps } = makeService([{ ...relA, status: 'pending' }]);
    maps.push(mkMap(14, 'Карта'));
    await expect(service.getModeMap(T1, 14)).rejects.toThrow(
      'No active relation',
    );
  });

  it('happy path: активная связь есть → get/update/delete по-прежнему работают (регрессия на сам фикс)', async () => {
    const { service, maps } = makeService([relA]);
    maps.push(mkMap(15, 'Живая карта'));
    await expect(service.getModeMap(T1, 15)).resolves.toMatchObject({
      title: 'Живая карта',
    });
    await expect(
      service.updateModeMap(T1, 15, { title: 'Обновлено' }),
    ).resolves.toMatchObject({ title: 'Обновлено' });
    await expect(service.deleteModeMap(T1, 15)).resolves.toBeUndefined();
    expect(maps).toHaveLength(0);
  });
});

describe('ModeMapsService — клиентский read-only доступ к своим картам', () => {
  it('listMyModeMaps: возвращает только карты этого клиента', async () => {
    const { service, maps } = makeService([relA]);
    maps.push(
      mkMap(1, 'A', { clientId: CLIENT_A }),
      mkMap(2, 'B', { clientId: CLIENT_B }),
    );
    const mine = await service.listMyModeMaps(CLIENT_A);
    expect(mine.map((m: any) => m.title)).toEqual(['A']);
  });

  it('getMyModeMap: клиент B не может прочитать карту клиента A по id — "Not found"', async () => {
    const { service, maps } = makeService([relA]);
    maps.push(mkMap(20, 'Карта Ани', { clientId: CLIENT_A }));
    await expect(service.getMyModeMap(CLIENT_B, 20)).rejects.toThrow(
      'Not found',
    );
    await expect(service.getMyModeMap(CLIENT_A, 20)).resolves.toMatchObject({
      title: 'Карта Ани',
    });
  });
});
