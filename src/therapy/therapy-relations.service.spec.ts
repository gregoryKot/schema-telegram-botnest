// Тесты на границу доступа терапевта (аудит 2026-07, этап 2а):
// assertRelation — единственный барьер между терапевтом и клиническими
// данными ЧУЖИХ клиентов; до этого файла он не был покрыт ни одним тестом.
// Плюс: правила joinAsClient. (Перенесено из therapy.authz.spec.ts при
// распиле TherapyService — 2д REMEDIATION_PLAN; conceptualization-тесты
// уехали в therapy-notes.service.spec.ts.)
//
// Этап 1.2/3.2 TEST_IMPROVEMENT_PLAN.md (2026-07-26): сервис был покрыт на
// 24% веток — общий хелпер therapy.test-helpers.ts (makeRelationPrismaMock)
// умеет только findFirst/findUnique/update на therapyRelation и не покрывает
// createInvite/getRelation/disconnect/getClients/addVirtualClient/
// addClientManually/renameClient. Ниже — локальный расширенный фейк Prisma
// (только для этого файла, test-helpers.ts не трогаем — общий для другого
// спека).
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';
import { MINIAPP_TGLINK } from '../telegram/telegram.constants';
import { randomBytes as mockableRandomBytes } from 'crypto';

// Ключ шифрования не задан (дев-режим crypto.ts) — encrypt() возвращает
// plaintext, что для этих тестов и нужно.

// randomBytes оборачиваем в jest.fn (по умолчанию делегирует в настоящую
// реализацию) — нужно только для теста коллизии кода в createInvite ниже:
// node crypto экспортирует randomBytes через non-configurable геттер,
// jest.spyOn на него падает («Cannot redefine property»), поэтому подменяем
// весь модуль через jest.mock.
jest.mock('crypto', () => {
  const actual: typeof import('crypto') = jest.requireActual('crypto');
  return { ...actual, randomBytes: jest.fn(actual.randomBytes) };
});

function makeService(rels: Rel[]) {
  const prisma: any = makeRelationPrismaMock(rels);
  const service = new TherapyRelationsService(prisma, {} as any);
  return { service, prisma };
}

const T1 = 100n; // терапевт-владелец
const T2 = 200n; // чужой терапевт
const CLIENT = 555n;

const activeRel: Rel = {
  id: 1,
  therapistId: T1,
  clientId: CLIENT,
  status: 'active',
  code: 'AAA111',
};

describe('assertRelation — граница доступа терапевта', () => {
  it('терапевт с активной связью проходит', async () => {
    const { service } = makeService([activeRel]);
    await expect(
      service.assertHasClient(T1, Number(CLIENT)),
    ).resolves.toBeUndefined();
  });

  it('ЧУЖОЙ терапевт к тому же клиенту — отказ', async () => {
    const { service } = makeService([activeRel]);
    await expect(service.assertHasClient(T2, Number(CLIENT))).rejects.toThrow(
      'No active relation',
    );
  });

  it('pending-связь доступа не даёт (клиент ещё не подтвердил)', async () => {
    const { service } = makeService([
      { ...activeRel, status: 'pending', clientId: null },
    ]);
    await expect(service.assertHasClient(T1, Number(CLIENT))).rejects.toThrow(
      'No active relation',
    );
  });

  it('виртуальный клиент (отрицательный id = -rel.id): владелец проходит, чужой — нет', async () => {
    const virtualRel: Rel = {
      id: 42,
      therapistId: T1,
      clientId: null,
      status: 'active',
      code: 'BBB222',
    };
    const { service } = makeService([virtualRel]);
    await expect(service.assertHasClient(T1, -42)).resolves.toBeUndefined();
    await expect(service.assertHasClient(T2, -42)).rejects.toThrow(
      'No active relation',
    );
  });
});

describe('joinAsClient — правила подключения по коду', () => {
  it('подключает по pending-коду и активирует связь', async () => {
    const rel: Rel = {
      id: 2,
      therapistId: T1,
      clientId: null,
      status: 'pending',
      code: 'CODE01',
    };
    const { service } = makeService([rel]);
    await expect(service.joinAsClient(CLIENT, 'code01')).resolves.toBe(true);
    expect(rel.status).toBe('active');
    expect(rel.clientId).toBe(CLIENT);
  });

  it('терапевт не может подключиться к собственному коду', async () => {
    const rel: Rel = {
      id: 3,
      therapistId: T1,
      clientId: null,
      status: 'pending',
      code: 'CODE02',
    };
    const { service } = makeService([rel]);
    await expect(service.joinAsClient(T1, 'CODE02')).resolves.toBe(false);
  });

  it('использованный код (active) не срабатывает повторно', async () => {
    const { service } = makeService([activeRel]);
    await expect(service.joinAsClient(777n, 'AAA111')).resolves.toBe(false);
  });

  it('клиент уже подключён к этому терапевту по другой связи — молча возвращает true, вторую связь не активирует', async () => {
    const pendingRel: Rel = {
      id: 4,
      therapistId: T1,
      clientId: null,
      status: 'pending',
      code: 'CODE03',
    };
    // activeRel: T1↔CLIENT уже active — вторая попытка подключиться к T1 по
    // новому коду не должна создавать дубль связи.
    const { service } = makeService([pendingRel, activeRel]);
    await expect(service.joinAsClient(CLIENT, 'CODE03')).resolves.toBe(true);
    expect(pendingRel.status).toBe('pending'); // не активирована — вернули true раньше update
    expect(pendingRel.clientId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Расширенный фейк Prisma для createInvite/getRelation/disconnect/getClients/
// addVirtualClient/addClientManually/renameClient — makeRelationPrismaMock
// выше не умеет findMany/create/updateMany/deleteMany и не знает про
// clientConceptualization/user. Локально для этого файла (test-helpers.ts
// не трогаем — он общий с therapy-notes.service.spec.ts).
interface FullRel {
  id: number;
  therapistId: bigint;
  clientId: bigint | null;
  status: string;
  code: string;
  clientAlias?: string | null;
  virtualClientName?: string | null;
  createdAt?: Date;
  therapyStartDate?: string | null;
  nextSession?: string | null;
  meetingDays?: number[] | null;
}

interface FakeUser {
  id: bigint;
  firstName: string | null;
}

interface FakeConcept {
  therapistId: bigint;
  clientId: bigint;
  schemaIds: string | string[] | null;
}

interface Overview {
  streak: number;
  daysSince: number;
  history: Array<{ date: string; ratings: Record<string, number> }>;
}

function relMatches(r: FullRel, where: any = {}): boolean {
  if (where.OR) return (where.OR as any[]).some((cond) => relMatches(r, cond));
  return (
    (where.id === undefined || r.id === where.id) &&
    (where.therapistId === undefined || r.therapistId === where.therapistId) &&
    (where.clientId === undefined || r.clientId === where.clientId) &&
    (where.status === undefined || r.status === where.status)
  );
}

function makeFullPrisma(
  rels: FullRel[],
  users: FakeUser[],
  concepts: FakeConcept[],
) {
  let nextId = rels.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const findUser = (id: bigint | null) =>
    id == null ? null : (users.find((u) => u.id === id) ?? null);
  const withIncludes = (rel: FullRel, include?: any) => {
    const out: any = { ...rel };
    if (include?.client) out.client = findUser(rel.clientId);
    if (include?.therapist) out.therapist = findUser(rel.therapistId);
    return out;
  };
  return {
    therapyRelation: {
      findUnique: async ({ where }: any) =>
        rels.find((r) => r.code === where.code) ?? null,
      findFirst: async ({ where, include }: any) => {
        const r = rels.find((x) => relMatches(x, where));
        return r ? withIncludes(r, include) : null;
      },
      findMany: async ({ where, include }: any) =>
        rels
          .filter((r) => relMatches(r, where))
          .map((r) => withIncludes(r, include)),
      create: async ({ data }: any) => {
        const rel: FullRel = {
          clientId: null,
          createdAt: new Date(),
          ...data,
          id: nextId++,
        };
        rels.push(rel);
        return rel;
      },
      update: async ({ where, data }: any) => {
        const r = rels.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      },
      updateMany: async ({ where, data }: any) => {
        const hit = rels.filter((r) => relMatches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: any) => {
        const before = rels.length;
        for (let i = rels.length - 1; i >= 0; i--)
          if (relMatches(rels[i], where)) rels.splice(i, 1);
        return { count: before - rels.length };
      },
    },
    clientConceptualization: {
      findMany: async ({ where }: any) =>
        concepts
          .filter((c) => c.therapistId === where.therapistId)
          .map((c) => ({ clientId: c.clientId, schemaIds: c.schemaIds })),
    },
    user: {
      findUnique: async ({ where }: any) => findUser(where.id),
    },
  };
}

function makeFullService(
  rels: FullRel[],
  users: FakeUser[] = [],
  concepts: FakeConcept[] = [],
  overviews: Map<string, Overview> = new Map(),
) {
  const prisma: any = makeFullPrisma(rels, users, concepts);
  const analyticsService: any = {
    getClientOverviews: async () => overviews,
  };
  const service = new TherapyRelationsService(prisma, analyticsService);
  return { service, prisma, rels, users, concepts };
}

describe('createInvite — генерация кода приглашения', () => {
  it('создаёт pending-связь с кодом и возвращает ссылку startapp', async () => {
    const { service, rels } = makeFullService([]);
    const result = await service.createInvite(T1);
    expect(result.code).toHaveLength(12);
    expect(result.url).toBe(
      `${MINIAPP_TGLINK}?startapp=therapy_${result.code}`,
    );
    expect(rels).toHaveLength(1);
    expect(rels[0].therapistId).toBe(T1);
    expect(rels[0].code).toBe(result.code);
  });

  it('коллизия кода (совпал с уже существующим) — генерирует заново', async () => {
    const dupCode = 'AABBCCDDEEFF'; // валидный hex, как randomCode()
    const { service, rels } = makeFullService([
      {
        id: 1,
        therapistId: T2,
        clientId: null,
        status: 'pending',
        code: dupCode,
      },
    ]);
    const spy = mockableRandomBytes as jest.Mock;
    spy.mockClear(); // сбросить счётчик вызовов от предыдущих тестов (общий мок на файл)
    spy
      .mockReturnValueOnce(Buffer.from(dupCode.toLowerCase(), 'hex'))
      .mockReturnValueOnce(Buffer.from('112233445566', 'hex'));
    try {
      const result = await service.createInvite(T1);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(result.code).toBe('112233445566');
      expect(rels).toHaveLength(2); // старая связь + новая, коллизия не перезаписала
    } finally {
      spy.mockClear();
    }
  });
});

describe('getRelation — статус связи для терапевта и клиента', () => {
  it('нет связи — null', async () => {
    const { service } = makeFullService([]);
    await expect(service.getRelation(T1)).resolves.toBeNull();
  });

  it('роль терапевта: активная связь с реальным клиентом', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    const info = await service.getRelation(T1);
    expect(info).toEqual({
      role: 'therapist',
      status: 'active',
      partnerName: 'Аня',
      partnerId: Number(CLIENT),
      code: 'AAA111',
      nextSession: null,
    });
  });

  it('роль терапевта: виртуальный клиент (clientId=null) — партнёр без имени/id', async () => {
    const { service } = makeFullService([
      {
        id: 1,
        therapistId: T1,
        clientId: null,
        status: 'active',
        code: 'VVV111',
        virtualClientName: 'Оффлайн-клиент',
        createdAt: new Date(),
      },
    ]);
    const info = await service.getRelation(T1);
    expect(info?.partnerName).toBeNull();
    expect(info?.partnerId).toBeNull();
  });

  it('роль клиента: активная связь, видит терапевта и nextSession', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          nextSession: '2026-08-01',
          createdAt: new Date(),
        },
      ],
      [{ id: T1, firstName: 'Терапевт Т' }],
    );
    const info = await service.getRelation(CLIENT);
    expect(info).toEqual({
      role: 'client',
      status: 'active',
      partnerName: 'Терапевт Т',
      partnerId: Number(T1),
      code: 'AAA111',
      nextSession: '2026-08-01',
    });
  });

  it('роль клиента: терапевт не резолвится (FK-запись без пользователя) — партнёр пуст, nextSession null по умолчанию', async () => {
    const { service } = makeFullService([
      {
        id: 1,
        therapistId: T1,
        clientId: CLIENT,
        status: 'active',
        code: 'AAA111',
        createdAt: new Date(),
      },
    ]); // терапевта нет в users — include вернёт null
    const info = await service.getRelation(CLIENT);
    expect(info?.partnerName).toBeNull();
    expect(info?.partnerId).toBeNull();
    expect(info?.nextSession).toBeNull();
  });
});

describe('disconnect — разрыв связи с любой стороны', () => {
  it('удаляет связи, где userId — терапевт ИЛИ клиент', async () => {
    const relAsTherapist: FullRel = {
      id: 1,
      therapistId: T1,
      clientId: CLIENT,
      status: 'active',
      code: 'AAA111',
    };
    const relAsClient: FullRel = {
      id: 2,
      therapistId: T2,
      clientId: T1, // T1 выступает клиентом другого терапевта
      status: 'active',
      code: 'BBB222',
    };
    const unrelated: FullRel = {
      id: 3,
      therapistId: T2,
      clientId: CLIENT,
      status: 'active',
      code: 'CCC333',
    };
    const { service, rels } = makeFullService([
      relAsTherapist,
      relAsClient,
      unrelated,
    ]);
    await service.disconnect(T1);
    expect(rels).toEqual([unrelated]);
  });
});

describe('getClients — список клиентов терапевта', () => {
  it('без связей — пустой список', async () => {
    const { service } = makeFullService([]);
    await expect(service.getClients(T1)).resolves.toEqual([]);
  });

  it('реальный клиент: индекс дня, история 14 дней, streak/daysSince из overview', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const overviews = new Map<string, Overview>([
      [
        String(CLIENT),
        {
          streak: 3,
          daysSince: 0,
          history: [
            {
              date: today,
              ratings: {
                attachment: 5,
                autonomy: 6,
                expression: 7,
                play: 8,
                limits: 9,
              },
            },
          ],
        },
      ],
    ]);
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          meetingDays: [1, 3],
          therapyStartDate: '2026-01-01',
          nextSession: '2026-08-01',
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
      [{ therapistId: T1, clientId: CLIENT, schemaIds: ['abandonment'] }],
      overviews,
    );
    const [client] = await service.getClients(T1);
    expect(client.telegramId).toBe(Number(CLIENT));
    expect(client.name).toBe('Аня');
    expect(client.streak).toBe(3);
    expect(client.lastActiveDate).toBe(today);
    expect(client.todayIndex).toBe(7); // (5+6+7+8+9)/5 = 7
    expect(client.recentIndexHistory[0]).toBe(7);
    expect(client.recentIndexHistory[1]).toBeNull();
    expect(client.meetingDays).toEqual([1, 3]);
    expect(client.therapyStartDate).toBe('2026-01-01');
    expect(client.nextSession).toBe('2026-08-01');
    expect(client.schemaIds).toEqual(['abandonment']);
  });

  it('реальный клиент без записи в overview-карте — дефолты (streak 0, daysSince -1 → lastActiveDate null)', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    const [client] = await service.getClients(T1);
    expect(client.streak).toBe(0);
    expect(client.lastActiveDate).toBeNull();
    expect(client.todayIndex).toBeNull();
    expect(client.meetingDays).toEqual([]); // rel.meetingDays не задан
    expect(client.nextSession).toBeNull();
    expect(client.schemaIds).toEqual([]); // конспектуализации нет
  });

  it('день с неполным набором оценок (не все 5 потребностей) — индекс за этот день null', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const overviews = new Map<string, Overview>([
      [
        String(CLIENT),
        {
          streak: 1,
          daysSince: 0,
          history: [{ date: today, ratings: { attachment: 5, autonomy: 6 } }],
        },
      ],
    ]);
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
      [],
      overviews,
    );
    const [client] = await service.getClients(T1);
    expect(client.todayIndex).toBeNull();
    expect(client.recentIndexHistory[0]).toBeNull();
  });

  it('schemaIds конспектуализации хранятся зашифрованной JSON-строкой — декодируются', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
      [
        {
          therapistId: T1,
          clientId: CLIENT,
          schemaIds: JSON.stringify(['mistrust', 'defectiveness']),
        },
      ],
    );
    const [client] = await service.getClients(T1);
    expect(client.schemaIds).toEqual(['mistrust', 'defectiveness']);
  });

  it('schemaIds конспектуализации — битая JSON-строка (decryptJson не распарсил) — фолбэк []', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
      [{ therapistId: T1, clientId: CLIENT, schemaIds: 'не валидный json{' }],
    );
    const [client] = await service.getClients(T1);
    expect(client.schemaIds).toEqual([]);
  });

  it('schemaIds конспектуализации неожиданного типа (не строка/массив) — фолбэк []', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
      [{ therapistId: T1, clientId: CLIENT, schemaIds: null }],
    );
    const [client] = await service.getClients(T1);
    expect(client.schemaIds).toEqual([]);
  });

  it('виртуальный клиент (без Telegram-аккаунта) — попадает в список с telegramId=-rel.id', async () => {
    const { service } = makeFullService([
      {
        id: 7,
        therapistId: T1,
        clientId: null,
        status: 'active',
        code: 'VVV111',
        virtualClientName: 'Оффлайн Иван',
        clientAlias: 'Псевдоним',
        createdAt: new Date(),
      },
    ]);
    const [client] = await service.getClients(T1);
    expect(client.telegramId).toBe(-7);
    expect(client.name).toBe('Оффлайн Иван');
    expect(client.clientAlias).toBe('Псевдоним');
    expect(client.streak).toBe(0);
    expect(client.recentIndexHistory).toEqual(Array(14).fill(null));
  });

  it('связь без клиента и без virtualClientName (использованный/брошенный код) — не попадает ни в реальные, ни в виртуальные', async () => {
    const { service } = makeFullService([
      {
        id: 9,
        therapistId: T1,
        clientId: null,
        status: 'active',
        code: 'ZZZ111',
        createdAt: new Date(),
      },
    ]);
    await expect(service.getClients(T1)).resolves.toEqual([]);
  });
});

describe('addVirtualClient — офлайн-клиент без Telegram', () => {
  it('создаёт связь с обрезанным именем и возвращает обновлённый список клиентов', async () => {
    const { service, rels } = makeFullService([]);
    const list = await service.addVirtualClient(T1, '  Оффлайн Пётр  ');
    expect(rels).toHaveLength(1);
    expect(rels[0].therapistId).toBe(T1);
    expect(rels[0].status).toBe('active');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Оффлайн Пётр');
    expect(list[0].telegramId).toBe(-rels[0].id);
  });
});

describe('addClientManually — подключение по Telegram ID без кода', () => {
  it('клиент не найден — ошибка, связь не создаётся', async () => {
    const { service, rels } = makeFullService([]);
    await expect(service.addClientManually(T1, CLIENT)).rejects.toThrow(
      'User not found',
    );
    expect(rels).toHaveLength(0);
  });

  it('уже есть активная связь с этим клиентом — ошибка "Already connected"', async () => {
    const { service, rels } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    await expect(service.addClientManually(T1, CLIENT)).rejects.toThrow(
      'Already connected',
    );
    expect(rels).toHaveLength(1); // повторной связи не создалось
  });

  it('успешное подключение — создаёт активную связь и возвращает список клиентов', async () => {
    const { service, rels } = makeFullService(
      [],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    const list = await service.addClientManually(T1, CLIENT);
    expect(rels).toHaveLength(1);
    expect(rels[0].status).toBe('active');
    expect(rels[0].clientId).toBe(CLIENT);
    expect(list).toHaveLength(1);
    expect(list[0].telegramId).toBe(Number(CLIENT));
    expect(list[0].name).toBe('Аня');
  });
});

describe('renameClient — псевдоним клиента (alias)', () => {
  it('реальный клиент (id ≥ 0): проставляет alias только владельцу связи', async () => {
    const own: FullRel = {
      id: 1,
      therapistId: T1,
      clientId: CLIENT,
      status: 'active',
      code: 'AAA111',
    };
    const foreign: FullRel = {
      id: 2,
      therapistId: T2,
      clientId: CLIENT,
      status: 'active',
      code: 'BBB222',
    };
    const { service } = makeFullService([own, foreign]);
    await service.renameClient(T1, Number(CLIENT), 'Псевдоним');
    expect(own.clientAlias).toBe('Псевдоним');
    expect(foreign.clientAlias).toBeUndefined(); // чужая связь не тронута
  });

  it('виртуальный клиент (id < 0): проставляет alias по id = -rel.id', async () => {
    const virtual: FullRel = {
      id: 5,
      therapistId: T1,
      clientId: null,
      status: 'active',
      code: 'VVV111',
      virtualClientName: 'Иван',
    };
    const { service } = makeFullService([virtual]);
    await service.renameClient(T1, -5, 'Новый псевдоним');
    expect(virtual.clientAlias).toBe('Новый псевдоним');
  });

  it('пустой/пробельный alias — очищает clientAlias (null)', async () => {
    const rel: FullRel = {
      id: 1,
      therapistId: T1,
      clientId: CLIENT,
      status: 'active',
      code: 'AAA111',
      clientAlias: 'Было',
    };
    const { service } = makeFullService([rel]);
    await service.renameClient(T1, Number(CLIENT), '   ');
    expect(rel.clientAlias).toBeNull();
  });
});
