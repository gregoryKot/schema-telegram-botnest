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
// renameClient. Ниже — локальный расширенный фейк Prisma
// (только для этого файла, test-helpers.ts не трогаем — общий для другого
// спека).
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';
import { randomBytes as mockableRandomBytes } from 'crypto';

// Имя бота без дефолта (telegram.constants.ts): для ссылки-приглашения задаём его
// явно, как это делает env прода.
jest.mock('../telegram/telegram.constants', () => ({
  ...jest.requireActual('../telegram/telegram.constants'),
  BOT_USERNAME: 'SchemeHappensBot',
}));

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
    await expect(service.assertHasClient(T1, CLIENT)).resolves.toBeUndefined();
  });

  it('ЧУЖОЙ терапевт к тому же клиенту — отказ', async () => {
    const { service } = makeService([activeRel]);
    await expect(service.assertHasClient(T2, CLIENT)).rejects.toThrow(
      'No active relation',
    );
  });

  it('pending-связь доступа не даёт (клиент ещё не подтвердил)', async () => {
    const { service } = makeService([
      { ...activeRel, status: 'pending', clientId: null },
    ]);
    await expect(service.assertHasClient(T1, CLIENT)).rejects.toThrow(
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
    await expect(service.assertHasClient(T1, -42n)).resolves.toBeUndefined();
    await expect(service.assertHasClient(T2, -42n)).rejects.toThrow(
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
// addVirtualClient/renameClient — makeRelationPrismaMock
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
  role?: 'CLIENT' | 'THERAPIST';
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
      count: async ({ where }: any) =>
        rels.filter((r) => relMatches(r, where)).length,
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
      `https://t.me/SchemeHappensBot/diary?startapp=therapy_${result.code}`,
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

// Инцидент 2026-10-26: «+ Новый клиент» с галочкой приглашения создавал
// офлайн-карточку «Мария К.» и независимое приглашение — после подключения в
// списке было две карточки. Теперь имя едет в приглашении, офлайн-карточки нет.
describe('приглашение из «Новый клиент» — после подключения одна карточка с именем терапевта', () => {
  it('createInvite(alias) → клиент подключился → getClients: ровно одна карточка, clientAlias = введённое имя', async () => {
    const { service, rels } = makeFullService(
      [],
      [{ id: CLIENT, firstName: 'Мария', role: 'CLIENT' }],
    );
    const { code } = await service.createInvite(T1, 'Мария К.');
    // До подключения карточки нет — приглашение ждёт в списке приглашений.
    await expect(service.getClients(T1)).resolves.toEqual([]);
    // Захват кода — как claimTherapyInvite (этот фейк не разбирает `{ not }`;
    // подключение через HTTP целиком — test/therapy-invite.e2e-spec.ts).
    const invite = rels.find((r) => r.code === code)!;
    Object.assign(invite, { clientId: CLIENT, status: 'active' });
    const clients = await service.getClients(T1);
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({
      telegramId: CLIENT,
      name: 'Мария',
      clientAlias: 'Мария К.',
    });
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
      [
        { id: CLIENT, firstName: 'Аня' },
        { id: T1, firstName: 'Т', role: 'THERAPIST' },
      ],
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
      partnerId: CLIENT,
      code: 'AAA111',
      nextSession: null,
      meetingDays: [],
    });
    expect(spy).toHaveBeenCalledWith({
      where: { therapistId: T1, status: 'active' },
      include: { client: { select: { firstName: true } } },
    });
  });

  it('роль терапевта: виртуальный клиент (clientId=null) — партнёр без имени/id', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: null,
          status: 'active',
          code: 'VVV111',
          virtualClientName: 'Оффлайн-клиент',
          createdAt: new Date(),
        },
      ],
      [{ id: T1, firstName: 'Т', role: 'THERAPIST' }],
    );
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
      [{ id: T1, firstName: 'Терапевт Т', role: 'THERAPIST' }],
    );
    const spy = jest.spyOn(prisma.therapyRelation, 'findFirst');
    const spyMany = jest.spyOn(prisma.therapyRelation, 'findMany');
    const info = await service.getRelation(CLIENT);
    expect(info).toEqual({
      role: 'client',
      status: 'active',
      partnerName: 'Терапевт Т',
      partnerId: T1,
      code: 'AAA111',
      nextSession: '2026-08-01',
      meetingDays: [],
    });
    // CLIENT терапевтом не выступает — связи со стороны терапевта не ищутся
    // вовсе (A-3): findFirst не зовётся, единственный запрос — findMany по
    // клиентской стороне, с ролью партнёра для сверки (backend#33).
    expect(spy).not.toHaveBeenCalled();
    expect(spyMany).toHaveBeenCalledTimes(1);
    expect(spyMany).toHaveBeenCalledWith({
      where: { clientId: CLIENT, status: 'active' },
      include: {
        therapist: { select: { id: true, firstName: true, role: true } },
      },
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
        { id: T1, firstName: 'Мой терапевт', role: 'THERAPIST' },
        { id: T2, firstName: 'Чужой терапевт', role: 'THERAPIST' },
      ],
    );
    const info = await service.getRelation(CLIENT);
    expect(info?.partnerName).toBe('Мой терапевт');
    expect(info?.code).toBe('AAA111');
  });

  // A-3 (аудит 2026-10): терапевт вышел из роли (role = CLIENT), а его строки
  // со стороны терапевта остались. «Мой терапевт» не должен показывать бывшего
  // клиента как «терапевта», а «Отключиться» — быть пустым действием.
  it('вышедший из роли терапевта (CLIENT) со старыми строками терапевта: клиентской связи нет → null', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'OLD111',
          createdAt: new Date(),
        },
      ],
      [
        { id: T1, firstName: 'Бывший терапевт', role: 'CLIENT' },
        { id: CLIENT, firstName: 'Его бывший клиент' },
      ],
    );
    await expect(service.getRelation(T1)).resolves.toBeNull();
  });

  it('вышедший из роли терапевта, но подключённый к новому терапевту как клиент: видит ИМЕННО его', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'OLD111',
          createdAt: new Date(),
        },
        {
          id: 2,
          therapistId: T2,
          clientId: T1,
          status: 'active',
          code: 'NEW222',
          nextSession: '2026-11-01',
          createdAt: new Date(),
        },
      ],
      [
        { id: T1, firstName: 'Бывший терапевт', role: 'CLIENT' },
        { id: T2, firstName: 'Новый терапевт', role: 'THERAPIST' },
        { id: CLIENT, firstName: 'Его бывший клиент' },
      ],
    );
    expect(await service.getRelation(T1)).toEqual({
      role: 'client',
      status: 'active',
      partnerName: 'Новый терапевт',
      partnerId: T2,
      code: 'NEW222',
      nextSession: '2026-11-01',
      meetingDays: [],
    });
  });

  it('действующий терапевт (THERAPIST) по-прежнему видит сторону терапевта', async () => {
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
      [
        { id: T1, firstName: 'Т', role: 'THERAPIST' },
        { id: CLIENT, firstName: 'Аня' },
      ],
    );
    expect((await service.getRelation(T1))?.role).toBe('therapist');
  });

  it('роль клиента: у терапевта нет имени — партнёр пуст, nextSession null по умолчанию', async () => {
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
      [{ id: T1, firstName: null, role: 'THERAPIST' }],
    );
    const info = await service.getRelation(CLIENT);
    expect(info?.partnerName).toBeNull();
    expect(info?.partnerId).toBe(T1);
    expect(info?.nextSession).toBeNull();
  });

  // 2026-10-26: клиент видел прошедшую встречу («Сб, 17 октября» при 26-м) —
  // nextSession после встречи никто не двигает. Ближайшую экраны клиента
  // считают сами (shared upcomingSession), а для этого им нужны дни встреч.
  it('клиент получает дни встреч своей связи, терапевт — пустой список', async () => {
    const rel = {
      id: 1,
      therapistId: T1,
      clientId: CLIENT,
      status: 'active',
      code: 'AAA111',
      nextSession: '2026-10-17T07:00',
      meetingDays: [6, 3],
      createdAt: new Date(),
    };
    const users: FakeUser[] = [
      { id: T1, firstName: 'Т', role: 'THERAPIST' },
      { id: CLIENT, firstName: 'Аня' },
    ];
    const { service } = makeFullService([rel], users);
    const asClient = await service.getRelation(CLIENT);
    expect(asClient?.meetingDays).toEqual([6, 3]);
    expect(asClient?.nextSession).toBe('2026-10-17T07:00'); // как в базе
    expect((await service.getRelation(T1))?.meetingDays).toEqual([]);
  });

  it('битые дни встреч в Json-колонке: остаются только целые 0–6, не массив → []', async () => {
    const withDays = (meetingDays: unknown) =>
      makeFullService(
        [
          {
            id: 1,
            therapistId: T1,
            clientId: CLIENT,
            status: 'active',
            code: 'AAA111',
            meetingDays: meetingDays as number[],
            createdAt: new Date(),
          },
        ],
        [{ id: T1, firstName: 'Т', role: 'THERAPIST' }],
      ).service.getRelation(CLIENT);
    const garbage = [6, 7, -1, 2.5, '3', null, 0];
    expect((await withDays(garbage))?.meetingDays).toEqual([6, 0]);
    expect((await withDays({ 0: 1 }))?.meetingDays).toEqual([]);
    expect((await withDays(null))?.meetingDays).toEqual([]);
  });

  // backend#33: строка, осиротевшая до статуса `ended` (терапевт вышел из
  // роли, связь осталась active), не показывает бывшего терапевта клиенту.
  it('партнёр уже не терапевт (role CLIENT) — «Мой терапевт» пуст', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'ORPHAN',
          createdAt: new Date(),
        },
      ],
      [{ id: T1, firstName: 'Бывший терапевт', role: 'CLIENT' }],
    );
    await expect(service.getRelation(CLIENT)).resolves.toBeNull();
  });

  it('осиротевшая связь не заслоняет живую: клиент видит действующего терапевта', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'ORPHAN',
          createdAt: new Date(),
        },
        {
          id: 2,
          therapistId: T2,
          clientId: CLIENT,
          status: 'active',
          code: 'LIVE22',
          createdAt: new Date(),
        },
      ],
      [
        { id: T1, firstName: 'Бывший терапевт', role: 'CLIENT' },
        { id: T2, firstName: 'Действующий', role: 'THERAPIST' },
      ],
    );
    const info = await service.getRelation(CLIENT);
    expect(info).toMatchObject({ partnerId: T2, code: 'LIVE22' });
  });

  it('завершённая связь (ended) клиенту не показывается', async () => {
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'ended',
          code: 'ENDED1',
          createdAt: new Date(),
        },
      ],
      [{ id: T1, firstName: 'Терапевт', role: 'THERAPIST' }],
    );
    await expect(service.getRelation(CLIENT)).resolves.toBeNull();
  });
});

describe('disconnect — клиент разрывает свои связи', () => {
  it('удаляет только связи, где userId — КЛИЕНТ; связи в роли терапевта остаются (T2, аудит 2026-10)', async () => {
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
    expect(rels).toEqual([relAsTherapist, unrelated]);
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
    expect(list[0].telegramId).toBe(CLIENT);
    expect(list[0].name).toBe('Аня');
  });

  // Аудит 2026-10, X-1: веб-клиент (Google/VK/MAX/почта) живёт в [1e15, 9e15),
  // ниже 2^53 (границу держит user-id-range.spec.ts). Id выше 2^53 здесь
  // выдуманный: он стережёт bigint-путь на случай расширения диапазона, когда
  // Number(id) округлит его и следующий запрос терапевта не пройдёт
  // assertRelation. Id обязан пройти от БД до ответа точным bigint.
  it('клиент с выдуманным id > 2^53: getClients и getRelation отдают точный bigint, assertHasClient проходит', async () => {
    const WEB = 1000000000000000123n;
    const { service } = makeFullService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: WEB,
          status: 'active',
          code: 'WEB111',
          createdAt: new Date(),
        },
      ],
      [
        { id: T1, firstName: 'Терапевт', role: 'THERAPIST' },
        { id: WEB, firstName: 'Вера' },
      ],
    );
    const [client] = await service.getClients(T1);
    expect(client.telegramId).toBe(WEB);
    expect(typeof client.telegramId).toBe('bigint');
    // Именно с таким id фронт придёт обратно; округлённый — чужая строка.
    await expect(
      service.assertHasClient(T1, client.telegramId),
    ).resolves.toBeUndefined();
    await expect(
      service.assertHasClient(T1, BigInt(Number(WEB))),
    ).rejects.toThrow('No active relation');
    expect((await service.getRelation(T1))?.partnerId).toBe(WEB);
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
    expect(client.telegramId).toBe(CLIENT);
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
    expect(client.telegramId).toBe(-7n);
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
    // Мутационное усиление (`?? []` у schemaIds виртуального клиента): без
    // конспектуализации под -rel.id список схем пустой, а не подставленный.
    expect(client.schemaIds).toEqual([]);
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
    expect(client.telegramId).toBe(-7n);
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
    expect(new Set(list.map((c) => c.telegramId))).toEqual(
      new Set([-2n, CLIENT]),
    );
  });

  // Мутационное усиление (фильтр виртуальных: `rel.client === null` →
  // `true`): у связи с реальным клиентом virtualClientName может остаться —
  // офлайн-клиент, позже подключившийся по коду. Такая связь — один реальный
  // клиент; без проверки на client === null она задвоилась бы виртуальной
  // записью с telegramId = -rel.id.
  it('связь с реальным клиентом и оставшимся virtualClientName — один реальный клиент, без виртуального двойника', async () => {
    const { service } = makeFullService(
      [
        {
          id: 4,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          code: 'AAA222',
          virtualClientName: 'Оффлайн Иван',
          createdAt: new Date(),
        },
      ],
      [{ id: CLIENT, firstName: 'Аня' }],
    );
    const list = await service.getClients(T1);
    expect(list.map((c) => c.telegramId)).toEqual([CLIENT]);
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
    expect(list[0].telegramId).toBe(-BigInt(rels[0].id));
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

describe('addClientManually — удалён', () => {
  // Метод создавал активную связь терапевт↔клиент без согласия клиента.
  // Реальный клиент подключается только по приглашению (joinAsClient);
  // пин не даёт методу вернуться.
  it('в сервисе нет метода ручного добавления реального пользователя', () => {
    const { service } = makeFullService([]);
    expect('addClientManually' in service).toBe(false);
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
    await service.renameClient(T1, CLIENT, 'Псевдоним');
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
    await service.renameClient(T1, -5n, 'Новый псевдоним');
    expect(virtual.clientAlias).toBe('Новый псевдоним');
    expect(foreignVirtual.clientAlias).toBeUndefined(); // чужая связь не тронута
  });

  // QA 2026-10-26: удалённого офлайн-клиента «переименовывали» — updateMany
  // на 0 строк считался успехом, ручка отвечала 201.
  it('удалённый офлайн-клиент или чужой клиент — бросает No active relation, ничего не пишет', async () => {
    const foreign: FullRel = {
      id: 2,
      therapistId: T2,
      clientId: CLIENT,
      status: 'active',
      code: 'BBB222',
    };
    const { service } = makeFullService([foreign]);
    await expect(service.renameClient(T1, -142n, 'Имя')).rejects.toThrow(
      'No active relation',
    );
    await expect(service.renameClient(T1, CLIENT, 'Имя')).rejects.toThrow(
      'No active relation',
    );
    expect(foreign.clientAlias).toBeUndefined();
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
    await service.renameClient(T1, CLIENT, '   ');
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
    await service.renameClient(T1, CLIENT, '  Псевдоним  ');
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
    await expect(service.assertHasClient(T1, 0n)).resolves.toBeUndefined();
    await service.renameClient(T1, 0n, 'Нулевой клиент');
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
  it('createInvite(alias): имя в приглашении сохраняется ЗАШИФРОВАННЫМ', async () => {
    const { Service, crypto } = loadWithRealEncryption();
    const rels: FullRel[] = [];
    const service = new Service(makeFullPrisma(rels, [], []) as any, {} as any);
    await service.createInvite(T1, 'Мария К.');
    expect(rels[0].clientAlias).not.toBe('Мария К.');
    expect(crypto.decrypt(rels[0].clientAlias ?? null)).toBe('Мария К.');
  });

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
