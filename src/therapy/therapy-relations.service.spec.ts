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

  // Мутационное усиление (docs/TEST_TRUST_PLAN.md п.2): три disjunct'а
  // `!rel || rel.status !== 'pending' || rel.clientId !== null` проверялись
  // только "снаружи" (успех/использованный код), но не по отдельности — три
  // теста ниже вместе образуют полную таблицу истинности всех трёх условий
  // (без него мутанты LogicalOperator/ConditionalExpression на этой строке
  // выживают, потому что любой ОДИН неверный disjunct маскируется двумя
  // другими).
  it('код не найден вовсе — отказ (не бросает, а именно false)', async () => {
    const { service } = makeService([]);
    await expect(service.joinAsClient(CLIENT, 'ZZZZZZ')).resolves.toBe(false);
  });

  it('связь в противоречивом состоянии pending + clientId уже проставлен — отказ', async () => {
    const rel: Rel = {
      id: 5,
      therapistId: T1,
      clientId: 999n, // не должно быть заполнено при status='pending', но защита должна отработать
      status: 'pending',
      code: 'CODE04',
    };
    const { service } = makeService([rel]);
    await expect(service.joinAsClient(CLIENT, 'CODE04')).resolves.toBe(false);
    expect(rel.clientId).toBe(999n); // не перезаписан новым клиентом
  });

  it('связь в противоречивом состоянии status≠pending + clientId ещё пуст — отказ', async () => {
    const rel: Rel = {
      id: 6,
      therapistId: T1,
      clientId: null,
      status: 'expired', // не 'pending' — код не должен активироваться, даже если clientId пуст
      code: 'CODE05',
    };
    const { service } = makeService([rel]);
    await expect(service.joinAsClient(CLIENT, 'CODE05')).resolves.toBe(false);
    expect(rel.clientId).toBeNull();
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
  // jest.fn(), не голая async-функция: часть новых тестов (мутационное
  // усиление, см. "getClients — batch-загрузка overview...") проверяет,
  // КАКИЕ id реально передаются в overview-сервис (jest.spyOn требует, чтобы
  // свойство уже было отслеживаемым, либо оборачиваем сразу здесь).
  const clientOverviewService = {
    getClientOverviews: jest.fn(async () => overviews),
  };
  const service = new TherapyRelationsService(prisma, clientOverviewService);
  return { service, prisma, rels, users, concepts, clientOverviewService };
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
    const { service, prisma } = makeFullService(
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
    // Мутационное усиление: локальный фейк Prisma игнорирует select (всегда
    // отдаёт всё поле), поэтому ObjectLiteral/BooleanLiteral-мутанты внутри
    // where/include/select не меняют результат теста — их ловит только
    // точная сверка аргументов, переданных в findFirst.
    const spy = jest.spyOn(prisma.therapyRelation, 'findFirst');
    const info = await service.getRelation(T1);
    expect(info).toEqual({
      role: 'therapist',
      status: 'active',
      partnerName: 'Аня',
      partnerId: Number(CLIENT),
      code: 'AAA111',
      nextSession: null,
    });
    expect(spy).toHaveBeenCalledWith({
      where: { therapistId: T1, status: 'active' },
      include: { client: { select: { firstName: true } } },
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
    const { service, prisma } = makeFullService(
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
    const spy = jest.spyOn(prisma.therapyRelation, 'findFirst');
    const info = await service.getRelation(CLIENT);
    expect(info).toEqual({
      role: 'client',
      status: 'active',
      partnerName: 'Терапевт Т',
      partnerId: Number(T1),
      code: 'AAA111',
      nextSession: '2026-08-01',
    });
    // Первый вызов — проверка роли терапевта (не находит, CLIENT терапевтом
    // не выступает), второй — роль клиента; сверяем именно его аргументы.
    expect(spy).toHaveBeenNthCalledWith(2, {
      where: { clientId: CLIENT, status: 'active' },
      include: { therapist: { select: { id: true, firstName: true } } },
    });
  });

  // Мутационное усиление: где-фильтр `{ clientId: uid, status: 'active' }`
  // (L78) не отличался от {} ни одним тестом выше — фейк без него просто
  // отдавал бы ПЕРВУЮ связь в базе. Кладём чужую связь первой и проверяем,
  // что клиент видит СВОЮ, а не чужую.
  it('клиент видит СВОЮ активную связь, а не первую подходящую в базе (изоляция по where)', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T2,
          clientId: 999n, // чужая связь, лежит в базе первой
          status: 'active',
          code: 'FOREIGN',
          createdAt: new Date(),
        },
        {
          id: 2,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [
        { id: T1, firstName: 'Мой терапевт' },
        { id: T2, firstName: 'Чужой терапевт' },
      ],
    );
    const info = await service.getRelation(CLIENT);
    expect(info?.partnerName).toBe('Мой терапевт');
    expect(info?.code).toBe('AAA111');
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

  // Мутационное усиление: where-фильтр `{ therapistId: tid, status: 'active' }`
  // (L103) — единственный барьер между терапевтом и списком клиентов ДРУГОГО
  // терапевта. Кладём чужую активную связь первой и проверяем, что она не
  // просачивается в список T1.
  it('не возвращает клиентов ЧУЖОГО терапевта (изоляция по where)', async () => {
    const FOREIGN_CLIENT = 888n;
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T2,
          clientId: FOREIGN_CLIENT,
          status: 'active',
          code: 'FOREIGN',
          createdAt: new Date(),
        },
        {
          id: 2,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA111',
          createdAt: new Date(),
        },
      ],
      [
        { id: FOREIGN_CLIENT, firstName: 'Чужой клиент' },
        { id: CLIENT, firstName: 'Аня' },
      ],
    );
    const list = await service.getClients(T1);
    expect(list).toHaveLength(1);
    expect(list[0].telegramId).toBe(Number(CLIENT));
    expect(list[0].name).toBe('Аня');
  });

  // Мутационное усиление: связь со статусом pending (приглашение ещё не
  // принято) не должна попадать в список клиентов — тот же where на L103.
  it('не включает связи со статусом pending (приглашение ещё не принято)', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: null,
          status: 'pending',
          code: 'PEND01',
          createdAt: new Date(),
        },
      ],
      [],
    );
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
    const { service, prisma, clientOverviewService } = makeFullService(
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
    const findManySpy = jest.spyOn(prisma.therapyRelation, 'findMany');
    const conceptsSpy = jest.spyOn(prisma.clientConceptualization, 'findMany');
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
    // Мутационное усиление (L104/L110): фейк игнорирует select-проекцию,
    // поэтому ObjectLiteral/BooleanLiteral внутри select/include ловим
    // только сверкой точных аргументов вызова.
    expect(findManySpy).toHaveBeenCalledWith({
      where: { therapistId: T1, status: 'active' },
      include: { client: { select: { id: true, firstName: true } } },
    });
    expect(conceptsSpy).toHaveBeenCalledWith({
      where: { therapistId: T1 },
      select: { clientId: true, schemaIds: true },
    });
    // Мутационное усиление (L128/L129): batch-запрос overview обязан уйти
    // РОВНО со списком bigint-id реальных клиентов этого терапевта — не
    // пустым списком и не списком undefined (ArrowFunction/ConditionalExpression
    // мутанты фильтра/маппера).
    expect(clientOverviewService.getClientOverviews).toHaveBeenCalledWith([
      CLIENT,
    ]);
  });

  // Мутационное усиление (L145/L153, ArithmeticOperator): при daysSince=0
  // "вчера-минус" и "вчера-плюс" дают одну и ту же дату (умножение на 0),
  // мутанты `+`/`/` вместо `-`/`*` не отличимы. Нужен ненулевой daysSince и
  // непустая точка в истории на ненулевом смещении.
  it('lastActiveDate и история 14 дней считаются от daysSince, а не «сегодня» (граница ненулевого смещения)', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000)
      .toISOString()
      .slice(0, 10);
    const overviews = new Map<string, Overview>([
      [
        String(CLIENT),
        {
          streak: 1,
          daysSince: 2, // клиент последний раз отмечался 2 дня назад
          history: [
            {
              date: twoDaysAgo,
              ratings: {
                attachment: 10,
                autonomy: 10,
                expression: 10,
                play: 10,
                limits: 10,
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
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
      [],
      overviews,
    );
    const [client] = await service.getClients(T1);
    expect(client.lastActiveDate).toBe(twoDaysAgo); // Date.now() - 2*86400000, не + и не /
    expect(client.recentIndexHistory[2]).toBe(10); // индекс дня 2 дня назад найден по правильной дате
    expect(client.recentIndexHistory[0]).toBeNull(); // сегодня оценок нет
    expect(client.recentIndexHistory[1]).toBeNull(); // 1 день назад — тоже пусто
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
    // Мутационное усиление (L193/L194/L195, LogicalOperator ?? → &&): без
    // therapyStartDate/nextSession/meetingDays у виртуального клиента `??`
    // и `&&` расходятся — `??` даёт null/[], `&&` даёт undefined (поле не
    // задано на rel вовсе). Прежде эти поля у виртуального клиента вообще
    // не проверялись.
    expect(client.therapyStartDate).toBeNull();
    expect(client.nextSession).toBeNull();
    expect(client.meetingDays).toEqual([]);
  });

  // Мутационное усиление (L196, LogicalOperator + UnaryOperator): schemaIds
  // виртуального клиента ищутся в conceptMap по СТРОКОВОМУ ключу "-rel.id"
  // (минус, не плюс) — конспектуализации офлайн-клиентов хранятся под
  // отрицательным id, потому что настоящего telegramId у них нет.
  it('виртуальный клиент: schemaIds находятся по ключу -rel.id, не +rel.id', async () => {
    const { service } = makeFullService(
      [
        {
          id: 7,
          therapistId: T1,
          clientId: null,
          status: 'active',
          code: 'VVV111',
          virtualClientName: 'Оффлайн Иван',
          createdAt: new Date(),
        },
      ],
      [],
      [{ therapistId: T1, clientId: -7n, schemaIds: ['abandonment'] }],
    );
    const [client] = await service.getClients(T1);
    expect(client.telegramId).toBe(-7);
    expect(client.schemaIds).toEqual(['abandonment']);
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

  // Мутационное усиление (L183, ConditionalExpression → true): если фильтр
  // виртуальных клиентов форсировать в "всегда true", в список попадут
  // ЛИШНИЕ записи — и реальный клиент задвоится (он и так уже в realClients),
  // и брошенный код (без virtualClientName) всплывёт мусорной записью с
  // name=null. Смешиваем все три типа в одном вызове и считаем итог ровно.
  it('микс реальный + виртуальный + брошенный код — итоговый список содержит РОВНО реального и виртуального, без задвоений и мусора', async () => {
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
        {
          id: 2,
          therapistId: T1,
          clientId: null,
          status: 'active',
          code: 'VVV111',
          virtualClientName: 'Оффлайн Иван',
          createdAt: new Date(),
        },
        {
          id: 3,
          therapistId: T1,
          clientId: null,
          status: 'active',
          code: 'ZZZ111', // брошенный код — не должен всплыть нигде
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    const list = await service.getClients(T1);
    expect(list).toHaveLength(2);
    const ids = list.map((c) => c.telegramId).sort((a, b) => a - b);
    expect(ids).toEqual([-2, Number(CLIENT)].sort((a, b) => a - b));
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

  // Мутационное усиление (L206, MethodExpression toUpperCase→toLowerCase):
  // Buffer.toString('hex') сам по себе уже отдаёт нижний регистр — мутант
  // toLowerCase() на нём НИКАК не виден (no-op), в отличие от toUpperCase().
  // Нужен детерминированный randomBytes с буквами в hex и точная сверка
  // регистра итогового кода.
  it('код связи для офлайн-клиента генерируется в ВЕРХНЕМ регистре', async () => {
    const { service, rels } = makeFullService([]);
    const spy = mockableRandomBytes as jest.Mock;
    spy.mockClear();
    spy.mockReturnValueOnce(Buffer.from('aabbccddee', 'hex'));
    try {
      await service.addVirtualClient(T1, 'Тест');
      expect(rels[0].code).toBe('AABBCCDDEE');
    } finally {
      spy.mockClear();
    }
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
    const { service, rels, prisma } = makeFullService(
      [],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    // Мутационное усиление (L226, ObjectLiteral/BooleanLiteral в select):
    // фейк отдаёт весь user-объект вне зависимости от select — ловим только
    // сверкой точных аргументов вызова findUnique.
    const userSpy = jest.spyOn(prisma.user, 'findUnique');
    const list = await service.addClientManually(T1, CLIENT);
    expect(rels).toHaveLength(1);
    expect(rels[0].status).toBe('active');
    expect(rels[0].clientId).toBe(CLIENT);
    expect(list).toHaveLength(1);
    expect(list[0].telegramId).toBe(Number(CLIENT));
    expect(list[0].name).toBe('Аня');
    expect(userSpy).toHaveBeenCalledWith({
      where: { id: CLIENT },
      select: { id: true, firstName: true },
    });
  });

  // Мутационное усиление (L231/L232, ObjectLiteral where→{}): если проверка
  // "уже подключён" потеряет свой where, findFirst вернёт ПЕРВУЮ связь в
  // таблице — здесь она принадлежит ЧУЖОМУ терапевту с ТЕМ ЖЕ клиентом — и
  // T1 ошибочно получит "Already connected", хотя своей связи с CLIENT у
  // него нет.
  it('активная связь ЧУЖОГО терапевта с тем же клиентом не мешает новому подключению (изоляция по where)', async () => {
    const { service, rels } = makeFullService(
      [
        {
          id: 1,
          therapistId: T2,
          clientId: CLIENT,
          status: 'active',
          code: 'FOREIGN',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    await service.addClientManually(T1, CLIENT); // не должно бросить "Already connected"
    const own = rels.find((r) => r.therapistId === T1);
    expect(own?.clientId).toBe(CLIENT);
    expect(own?.status).toBe('active');
  });

  // Мутационное усиление (L237, MethodExpression toUpperCase→toLowerCase) —
  // см. аналогичный тест в addVirtualClient выше.
  it('код связи при ручном подключении генерируется в ВЕРХНЕМ регистре', async () => {
    const { service, rels } = makeFullService(
      [],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    const spy = mockableRandomBytes as jest.Mock;
    spy.mockClear();
    spy.mockReturnValueOnce(Buffer.from('aabbccddee', 'hex'));
    try {
      await service.addClientManually(T1, CLIENT);
      expect(rels[0].code).toBe('AABBCCDDEE');
    } finally {
      spy.mockClear();
    }
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

  it('виртуальный клиент (id < 0): проставляет alias по id = -rel.id, чужую виртуальную связь не трогает', async () => {
    const virtual: FullRel = {
      id: 5,
      therapistId: T1,
      clientId: null,
      status: 'active',
      code: 'VVV111',
      virtualClientName: 'Иван',
    };
    // Мутационное усиление (L280, ObjectLiteral where→{}): без чужой связи
    // в наборе пустой where неотличим от настоящего — оба обновят
    // единственную запись. Кладём ЧУЖУЮ виртуальную связь с другим id рядом.
    const foreignVirtual: FullRel = {
      id: 6,
      therapistId: T2,
      clientId: null,
      status: 'active',
      code: 'VVV222',
      virtualClientName: 'Пётр',
    };
    const { service } = makeFullService([virtual, foreignVirtual]);
    await service.renameClient(T1, -5, 'Новый псевдоним');
    expect(virtual.clientAlias).toBe('Новый псевдоним');
    expect(foreignVirtual.clientAlias).toBeUndefined(); // чужая связь не тронута
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

  // Мутационное усиление (L277, MethodExpression — вырезание .trim() у
  // encrypt(alias.trim())): в дев-режиме encrypt() отдаёт текст как есть,
  // поэтому необрезанные пробелы утекут прямо в сохранённое значение, если
  // .trim() перед encrypt() потеряется.
  it('alias с пробелами по краям сохраняется ОБРЕЗАННЫМ (encrypt(alias.trim()), не encrypt(alias))', async () => {
    const rel: FullRel = {
      id: 1,
      therapistId: T1,
      clientId: CLIENT,
      status: 'active',
      code: 'AAA111',
    };
    const { service } = makeFullService([rel]);
    await service.renameClient(T1, Number(CLIENT), '  Псевдоним  ');
    expect(rel.clientAlias).toBe('Псевдоним');
  });

  // Мутационное усиление (L258/L278, EqualityOperator < → <=): clientId=0 —
  // граница между "реальный клиент" и "виртуальный клиент (-rel.id)". При
  // <= 0 нулевой id ошибочно уходит в ветку виртуального клиента и ищет
  // связь по id=-0(=0), которой не существует (id связей начинаются с 1).
  it('clientId=0 — граница: обрабатывается как РЕАЛЬНЫЙ клиент, не как виртуальный', async () => {
    const rel: FullRel = {
      id: 1,
      therapistId: T1,
      clientId: 0n,
      status: 'active',
      code: 'AAA111',
    };
    const { service } = makeFullService([rel]);
    await expect(service.assertHasClient(T1, 0)).resolves.toBeUndefined();
    await service.renameClient(T1, 0, 'Нулевой клиент');
    expect(rel.clientAlias).toBe('Нулевой клиент');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Реальное шифрование PII (decName / virtualClientName) — мутанты L10/L213
// (`decrypt(v) ?? v` / `encrypt(x) ?? x`, заменённые на `&&`). Весь остальной
// файл намеренно работает в дев-режиме без ENCRYPTION_KEY, где encrypt()
// тождественна ("Ключ шифрования не задан" в шапке файла) — там decrypt(v)
// всегда равен v, и `??`/`&&` неотличимы. Различить их можно только когда
// decrypt()/encrypt() реально меняют значение — грузим свежую копию crypto.ts
// и сервиса с настоящим ключом через jest.isolateModules (паттерн из
// src/utils/crypto.spec.ts), не трогая кэш модулей остальных тестов файла.
type TherapyRelationsServiceModule =
  typeof import('./therapy-relations.service');
type CryptoModule = typeof import('../utils/crypto');

const REAL_KEY = 'ab'.repeat(32); // 64 hex-символа = валидный AES-256 ключ

function loadWithRealEncryption(): {
  Service: TherapyRelationsServiceModule['TherapyRelationsService'];
  crypto: CryptoModule;
} {
  const prevKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = REAL_KEY;
  try {
    let Service!: TherapyRelationsServiceModule['TherapyRelationsService'];
    let crypto!: CryptoModule;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      crypto = require('../utils/crypto') as CryptoModule;
      const mod = (() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('./therapy-relations.service') as TherapyRelationsServiceModule;
      })();
      Service = mod.TherapyRelationsService;
    });
    return { Service, crypto };
  } finally {
    if (prevKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = prevKey;
  }
}

describe('расшифровка PII при реально настроенном ENCRYPTION_KEY', () => {
  it('getClients: clientAlias — расшифрованное значение, а не сырой шифротекст', async () => {
    const { Service, crypto } = loadWithRealEncryption();
    const ciphertext = crypto.encrypt('Настоящий алиас');
    expect(ciphertext).not.toBe('Настоящий алиас'); // убеждаемся, что реально зашифровалось
    const rel: FullRel = {
      id: 1,
      therapistId: T1,
      clientId: CLIENT,
      status: 'active',
      code: 'AAA111',
      clientAlias: ciphertext,
      createdAt: new Date(),
    };
    const prisma: any = makeFullPrisma(
      [rel],
      [{ id: CLIENT, firstName: 'Аня' }],
      [],
    );
    const clientOverviewService: any = {
      getClientOverviews: async () => new Map(),
    };
    const service = new Service(prisma, clientOverviewService);
    const [client] = await service.getClients(T1);
    // decrypt(v) ?? v — расшифрованный текст. Мутант decrypt(v) && v отдал
    // бы сырой ciphertext (второй операнд), т.к. decrypt(v) здесь truthy.
    expect(client.clientAlias).toBe('Настоящий алиас');
  });

  it('addVirtualClient: virtualClientName сохраняется ЗАШИФРОВАННЫМ, а не как есть', async () => {
    const { Service, crypto } = loadWithRealEncryption();
    const rels: FullRel[] = [];
    const prisma: any = makeFullPrisma(rels, [], []);
    const clientOverviewService: any = {
      getClientOverviews: async () => new Map(),
    };
    const service = new Service(prisma, clientOverviewService);
    await service.addVirtualClient(T1, 'Оффлайн Пётр');
    // encrypt(x) ?? x — сохранённое значение это ciphertext. Мутант
    // encrypt(x) && x отдал бы ИСХОДНЫЙ ПЛЕЙНТЕКСТ (второй операнд, т.к.
    // encrypt(x) здесь truthy) — PII легло бы в БД незашифрованным.
    expect(rels[0].virtualClientName).not.toBe('Оффлайн Пётр');
    expect(crypto.decrypt(rels[0].virtualClientName ?? null)).toBe(
      'Оффлайн Пётр',
    );
  });
});
