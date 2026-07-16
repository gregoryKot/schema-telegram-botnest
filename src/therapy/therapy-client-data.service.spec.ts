// TEST_COVERAGE_PLAN.md, этап 3 п.11: TherapyClientDataService раскрывает
// терапевту клинические данные КЛИЕНТА. Единственная граница — assertHasClient
// (активная связь). Тестируем: (a) доступ с активной связью, (b) отказ без
// связи/с pending-связью, (c) изоляция между клиентами, (d) расшифровка на
// чтении, (e) ownership на write-путях. Ключа шифрования нет — encrypt()/
// decrypt() passthrough, но реально вызываются на пути чтения.
import { TherapyClientDataService } from './therapy-client-data.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';
import { encrypt, encryptJson } from '../utils/crypto';

const blank = { triggers: '', feelings: '', thoughts: '', behavior: '' };
const blankSchemaNote = { ...blank, origins: '', reality: '', healthyView: '' };
const blankModeNote = { ...blank, needs: '' };
const mkUser = (id: bigint, name: string, schemas: string[], share = true) => ({
  id,
  firstName: name,
  mySchemaIds: schemas,
  myModeIds: [],
  therapistShareProfile: share,
});
const mkDiaryRow = (userId: bigint, schemaIds: string[], trigger: string) => ({
  userId,
  schemaIds: JSON.stringify(schemaIds),
  trigger: encrypt(trigger) ?? trigger,
  createdAt: new Date('2026-07-10T10:00:00Z'),
});
const mkSchemaNote = (
  id: number,
  userId: bigint,
  schemaId: string,
  o: any = {},
) => ({ id, userId, schemaId, ...blankSchemaNote, ...o });
const mkModeNote = (
  id: number,
  userId: bigint,
  modeId: string,
  o: any = {},
) => ({ id, userId, modeId, ...blankModeNote, ...o });

function makeDb(rels: Rel[]) {
  const base = makeRelationPrismaMock(rels);
  const relWhere = (r: Rel, w: any) =>
    (w.id === undefined || r.id === w.id) &&
    (w.therapistId === undefined || r.therapistId === w.therapistId) &&
    (w.clientId === undefined || r.clientId === w.clientId);
  const users: any[] = [];
  const schemaDiary: any[] = [];
  const modeDiary: any[] = [];
  const gratitudeDiary: any[] = [];
  const schemaNotes: any[] = [];
  const modeNotes: any[] = [];
  const desc = (rows: any[], userId: bigint, key: string, take: number) =>
    rows
      .filter((r) => r.userId === userId)
      .sort((a, b) => (a[key] < b[key] ? 1 : a[key] > b[key] ? -1 : 0))
      .slice(0, take);
  const many = (rows: any[], key = 'createdAt') =>
    jest.fn(({ where, take }: any) =>
      Promise.resolve(desc(rows, where.userId, key, take)),
    );
  const findByUser = (rows: any[]) =>
    jest.fn(({ where }: any) =>
      Promise.resolve(rows.filter((n) => n.userId === where.userId)),
    );

  const db: any = {
    therapyRelation: {
      ...base.therapyRelation,
      updateMany: jest.fn(({ where, data }: any) => {
        const hit = rels.filter((r) => relWhere(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return Promise.resolve({ count: hit.length });
      }),
      deleteMany: jest.fn(({ where }: any) => {
        const before = rels.length;
        for (let i = rels.length - 1; i >= 0; i--)
          if (relWhere(rels[i], where)) rels.splice(i, 1);
        return Promise.resolve({ count: before - rels.length });
      }),
    },
    user: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(users.find((u) => u.id === where.id) ?? null),
      ),
    },
    ysqResult: { findUnique: jest.fn(() => Promise.resolve(null)) },
    ysqResultHistory: { findMany: jest.fn(() => Promise.resolve([])) },
    schemaDiaryEntry: { findMany: many(schemaDiary) },
    modeDiaryEntry: { findMany: many(modeDiary) },
    gratitudeDiaryEntry: { findMany: many(gratitudeDiary, 'date') },
    userSchemaNote: { findMany: findByUser(schemaNotes) },
    userModeNote: { findMany: findByUser(modeNotes) },
    therapistNote: { deleteMany: jest.fn(() => Promise.resolve({ count: 0 })) },
    clientConceptualization: {
      deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
    $transaction: jest.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(db),
    ),
  };
  return {
    db,
    users,
    schemaDiary,
    modeDiary,
    gratitudeDiary,
    schemaNotes,
    modeNotes,
  };
}

function makeService(rels: Rel[]) {
  const t = makeDb(rels);
  const relationsService = new TherapyRelationsService(t.db, {} as any);
  const analyticsService = {
    getHistoryRatings: jest.fn(() => Promise.resolve([])),
  } as any;
  const notificationService = {
    schedule: jest.fn(() => Promise.resolve(undefined)),
  } as any;
  const svc = new TherapyClientDataService(
    t.db,
    analyticsService,
    notificationService,
    relationsService,
  );
  return { svc, ...t, rels };
}

const T1 = 100n; // терапевт-владелец связи с CLIENT_A
const T2 = 200n; // чужой терапевт — не должен видеть данные CLIENT_A
const CLIENT_A = 555n;
const CLIENT_B = 777n;
const CID_A = Number(CLIENT_A);
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

describe('TherapyClientDataService — граница доступа (assertHasClient)', () => {
  it.each<[string, (svc: TherapyClientDataService) => Promise<unknown>]>([
    ['getClientData', (svc) => svc.getClientData(T2, CID_A)],
    ['getClientHistory', (svc) => svc.getClientHistory(T2, CID_A)],
    ['getClientDiaryEntries', (svc) => svc.getClientDiaryEntries(T2, CID_A)],
    ['getClientSchemaNotes', (svc) => svc.getClientSchemaNotes(T2, CID_A)],
    ['getClientModeNotes', (svc) => svc.getClientModeNotes(T2, CID_A)],
    ['requestYsq', (svc) => svc.requestYsq(T2, CID_A)],
    [
      'updateSessionInfo',
      (svc) => svc.updateSessionInfo(T2, CID_A, { nextSession: '2026-08-01' }),
    ],
  ])(
    '%s без активной связи с клиентом → отказ (No active relation)',
    async (_n, call) => {
      const { svc } = makeService([relA]); // связь есть, но у T1, не у T2
      await expect(call(svc)).rejects.toThrow('No active relation');
    },
  );

  it('pending-связь (клиент не подтвердил) доступа не даёт', async () => {
    const { svc } = makeService([{ ...relA, status: 'pending' }]);
    await expect(svc.getClientData(T1, CID_A)).rejects.toThrow(
      'No active relation',
    );
  });

  it('терапевт с активной связью получает данные; при therapistShareProfile=false — только имя', async () => {
    const { svc, users } = makeService([relA]);
    users.push(mkUser(CLIENT_A, 'Аня', ['abandonment']));
    const shared = await svc.getClientData(T1, CID_A);
    expect(shared.name).toBe('Аня');
    expect(shared.mySchemaIds).toEqual(['abandonment']);

    users[0].therapistShareProfile = false;
    const hidden = await svc.getClientData(T1, CID_A);
    expect(hidden.name).toBe('Аня');
    expect(hidden.mySchemaIds).toEqual([]);
    expect(hidden.myModeIds).toEqual([]);
  });
});

describe('TherapyClientDataService — изоляция между клиентами одного терапевта', () => {
  it('данные/дневник/заметки клиента A не содержат ничего от клиента B', async () => {
    const { svc, users, schemaDiary, schemaNotes } = makeService([relA, relB]);
    users.push(
      mkUser(CLIENT_A, 'Аня', ['abandonment']),
      mkUser(CLIENT_B, 'Боря', ['mistrust']),
    );
    schemaDiary.push(
      mkDiaryRow(CLIENT_A, ['abandonment'], 'триггер А'),
      mkDiaryRow(CLIENT_B, ['mistrust'], 'триггер Б'),
    );
    schemaNotes.push(
      mkSchemaNote(1, CLIENT_A, 'abandonment', { triggers: 'т-А' }),
      mkSchemaNote(2, CLIENT_B, 'mistrust', { triggers: 'т-Б' }),
    );

    const dataA = await svc.getClientData(T1, CID_A);
    const entries = await svc.getClientDiaryEntries(T1, CID_A);
    const notes = await svc.getClientSchemaNotes(T1, CID_A);

    expect(dataA.name).toBe('Аня');
    expect(dataA.mySchemaIds).toEqual(['abandonment']);
    expect(entries).toHaveLength(1);
    expect(entries[0].excerpt).toBe('триггер А');
    expect(notes).toHaveLength(1);
    expect(notes[0].schemaId).toBe('abandonment');
  });
});

describe('TherapyClientDataService — расшифровка на пути чтения', () => {
  it('дневник схем/режимов/благодарности: поля приходят расшифрованными к plaintext', async () => {
    const { svc, schemaDiary, modeDiary, gratitudeDiary } = makeService([relA]);
    schemaDiary.push({
      ...mkDiaryRow(CLIENT_A, [], 'меня проигнорировали'),
      schemaIds: encryptJson(['abandonment', 'mistrust']),
    });
    modeDiary.push({
      userId: CLIENT_A,
      modeId: encrypt('vulnerable_child') ?? 'vulnerable_child',
      situation: encrypt('поругались с партнёром') ?? 'поругались с партнёром',
      createdAt: new Date('2026-07-10T09:00:00Z'),
    });
    gratitudeDiary.push({
      userId: CLIENT_A,
      date: '2026-07-09',
      items: encryptJson(['выспалась', 'вкусный кофе', 'солнце']),
    });
    const entries = await svc.getClientDiaryEntries(T1, CID_A);
    const schemaEntry = entries.find((e) => e.type === 'schema')!;
    const modeEntry = entries.find((e) => e.type === 'mode')!;
    const gratEntry = entries.find((e) => e.type === 'gratitude')!;
    expect(schemaEntry.excerpt).toBe('меня проигнорировали');
    expect(schemaEntry.schemaIds).toEqual(['abandonment', 'mistrust']);
    expect(modeEntry.modeId).toBe('vulnerable_child');
    expect(modeEntry.excerpt).toBe('поругались с партнёром');
    // excerpt дневника благодарности — первые 2 пункта через « · »
    expect(gratEntry.excerpt).toBe('выспалась · вкусный кофе');
  });

  it('заметки по схеме и режиму: decryptRecord возвращает исходные строки полей', async () => {
    const { svc, schemaNotes, modeNotes } = makeService([relA]);
    schemaNotes.push(
      mkSchemaNote(1, CLIENT_A, 'abandonment', {
        triggers: encrypt('партнёр опоздал') ?? 'партнёр опоздал',
        feelings: encrypt('тревога') ?? 'тревога',
      }),
    );
    modeNotes.push(
      mkModeNote(1, CLIENT_A, 'vulnerable_child', {
        triggers: encrypt('одиночество') ?? 'одиночество',
        needs: encrypt('поддержка') ?? 'поддержка',
      }),
    );
    const [sNote] = await svc.getClientSchemaNotes(T1, CID_A);
    const [mNote] = await svc.getClientModeNotes(T1, CID_A);
    expect(sNote.triggers).toBe('партнёр опоздал');
    expect(sNote.feelings).toBe('тревога');
    expect(mNote.triggers).toBe('одиночество');
    expect(mNote.needs).toBe('поддержка');
  });
});

describe('TherapyClientDataService — ownership на write-путях', () => {
  it('updateSessionInfo: чужой терапевт отклонён без записи в БД, владелец — применяет', async () => {
    const { svc, db, rels } = makeService([relA]); // связь есть только у T1
    await expect(
      svc.updateSessionInfo(T2, CID_A, { nextSession: '2026-08-01' }),
    ).rejects.toThrow('No active relation');
    expect(db.therapyRelation.updateMany).not.toHaveBeenCalled();

    await svc.updateSessionInfo(T1, CID_A, { nextSession: '2026-08-01' });
    expect((rels[0] as any).nextSession).toBe('2026-08-01');
  });

  // Находка для отчёта (не баг-фикс): removeClient НЕ вызывает assertHasClient
  // явно — в отличие от всех остальных методов сервиса. Функционально не дыра:
  // WHERE в therapyRelation.deleteMany ограничен therapistId, чужой терапевт
  // не может удалить чужую связь физически. Но поведение отличается от
  // остальных методов (нет 403 вместо no-op) — тест фиксирует текущее поведение.
  it('removeClient: чужой терапевт не выбрасывает и не удаляет связь, владелец — удаляет', async () => {
    const { svc, rels } = makeService([relA]);
    await expect(svc.removeClient(T2, CID_A)).resolves.toBeUndefined();
    expect(rels).toHaveLength(1); // связь T1↔A цела

    await svc.removeClient(T1, CID_A);
    expect(rels).toHaveLength(0);
  });
});
