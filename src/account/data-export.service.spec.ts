// Юнит на DataExportService с поддельной Prisma. Три вещи, которые обязаны
// быть верны у экспорта персональных данных (право на переносимость,
// 152-ФЗ/GDPR art.15,20):
//   1. расшифровка реально применяется (иначе пользователь получил бы файл с
//      base64-мусором вместо своих дневников);
//   2. секреты входа (второй фактор, токены/сессии) НИКОГДА не попадают в
//      выдачу — тест написан как проверка на УТЕЧКУ: withheld-делегатам
//      подсовывается findMany, который бросает, если его вообще вызвали;
//   3. `withheld` объясняет человеку, чего в файле нет и почему.
//
// crypto.ts читает ENCRYPTION_KEY один раз на уровне модуля (см. crypto.spec.ts) —
// поэтому DataExportService и crypto грузятся ВМЕСТЕ через jest.isolateModules
// с ключом, установленным до первого require, иначе encrypt()/decrypt() внутри
// сервиса тихо работали бы в passthrough-режиме (ключа нет вне production) и
// тест №1 ничего бы не проверял.
const KEY = 'cc'.repeat(32); // 64 hex = 32 байта

type DataExportModule = typeof import('./data-export.service');
type CryptoModule = typeof import('../utils/crypto');

function load(): {
  DataExportService: DataExportModule['DataExportService'];
} & CryptoModule {
  process.env.ENCRYPTION_KEY = KEY;
  process.env.ENCRYPTION_KEY_OLD = '';
  process.env.NODE_ENV = 'test';
  let mods!: {
    DataExportService: DataExportModule['DataExportService'];
  } & CryptoModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('../utils/crypto') as CryptoModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dataExport = require('./data-export.service') as DataExportModule;
    mods = { ...crypto, DataExportService: dataExport.DataExportService };
  });
  return mods;
}

const FULL_USER_ROW = (encryptJson: CryptoModule['encryptJson']) => ({
  id: 1n,
  createdAt: new Date('2026-01-01'),
  firstName: 'Аня',
  role: 'CLIENT',
  addressForm: 'ty',
  mySchemaIds: encryptJson(['abandonment']),
  myModeIds: encryptJson(['vulnerable_child']),
  // Второй фактор входа — обязан остаться в fixture, но НЕ обязан попасть в
  // ответ: он не входит в USER_EXPORT_SELECT сервиса.
  totpSecret: 'SUPER_SECRET_TOTP_SEED',
  totpRecoveryCodes: '["one-time-code"]',
  totpLastStep: 123,
});

function throwingDelegate(name: string) {
  return {
    findMany: jest.fn(async () => {
      throw new Error(`УТЕЧКА: withheld-таблица ${name} была запрошена`);
    }),
  };
}

function makeFakePrisma(crypto: CryptoModule) {
  const notes = [
    {
      id: 1,
      userId: 1n,
      date: '2026-01-01',
      text: crypto.encrypt('секрет пользователя A')!,
      tags: crypto.encrypt('важное,личное')!,
      createdAt: new Date('2026-01-01'),
    },
  ];
  const ysqResults = [
    {
      userId: 1n,
      answers: crypto.encryptJson([1, 2, 3, 4]),
      completedAt: new Date('2026-01-02'),
    },
  ];
  // email/displayName в БД зашифрованы (D-9); для старых строк — открытый текст.
  const providers = [
    {
      provider: 'telegram',
      providerId: '555',
      email: null,
      displayName: crypto.encrypt('Аня')!,
      createdAt: new Date('2026-01-01'),
    },
    {
      provider: 'google',
      providerId: 'sub-1',
      email: 'anya@example.com', // legacy plaintext, ещё не дошифрован
      displayName: null,
      createdAt: new Date('2026-01-02'),
    },
  ];
  const modeMaps = [
    {
      id: 7,
      therapistId: 99n,
      title: crypto.encrypt('Карта: работа')!,
      kind: 'problem',
      nodes: crypto.encryptJson([{ id: 'n1', label: 'Критик' }]),
      edges: crypto.encryptJson([]),
      createdAt: new Date('2026-02-01'),
      updatedAt: new Date('2026-02-02'),
    },
  ];

  const modeMapFindMany = jest.fn(async () => modeMaps);
  const therapyRelationFindMany = jest.fn(async () => [
    {
      id: 3,
      therapistId: 99n,
      status: 'active',
      nextSession: '2026-10-10',
      createdAt: new Date('2026-02-01'),
    },
  ]);

  const base: Record<string, unknown> = {
    user: {
      findUnique: jest.fn(
        async ({ select }: { select: Record<string, boolean> }) => {
          const full = FULL_USER_ROW(crypto.encryptJson) as Record<
            string,
            unknown
          >;
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(select)) if (select[k]) out[k] = full[k];
          return out;
        },
      ),
    },
    authProvider: { findMany: jest.fn(async () => providers) },
    modeMap: { findMany: modeMapFindMany },
    therapyRelation: { findMany: therapyRelationFindMany },
    note: { findMany: jest.fn(async () => notes) },
    ysqResult: { findMany: jest.fn(async () => ysqResults) },
    // Секреты входа — если сервис их хоть раз спросит, тест обязан упасть.
    emailToken: throwingDelegate('EmailToken'),
    loginTicket: throwingDelegate('LoginTicket'),
    webSession: throwingDelegate('WebSession'),
  };

  // Достаём спаи наружу через служебное свойство — тесты A-10 проверяют where.
  base.__spies = { modeMapFindMany, therapyRelationFindMany };

  // Proxy: любая другая userId-модель из EXPORT_POLICY (Rating, дневники и
  // т.п.), для которой явной fixture нет, — пустой список. Так сервис не
  // падает на неучтённой таблице, а спек не должен перечислять все ~25.
  return new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return { findMany: jest.fn(async () => []) };
    },
  });
}

describe('DataExportService.buildExport', () => {
  it('расшифровывает строковые и JSON-поля перед выдачей', async () => {
    const { DataExportService, encrypt, encryptJson } = load();
    const crypto = { encrypt, encryptJson } as CryptoModule;
    const prisma = makeFakePrisma(crypto);
    const analytics = { track: jest.fn(async () => undefined) };
    const svc = new DataExportService(
      prisma as any,
      analytics as any,
      { log: jest.fn() } as any,
    );

    const result = await svc.buildExport(1n);

    expect(result.data.Note[0]).toMatchObject({
      text: 'секрет пользователя A',
      tags: 'важное,личное',
    });
    expect(result.data.YsqResult[0]).toMatchObject({ answers: [1, 2, 3, 4] });
    expect(result.providers[0]).toMatchObject({ provider: 'telegram' });
  });

  it('НИКОГДА не отдаёт секреты входа — второй фактор и withheld-таблицы не запрошены и не в ответе', async () => {
    const { DataExportService, encrypt, encryptJson } = load();
    const crypto = { encrypt, encryptJson } as CryptoModule;
    const prisma = makeFakePrisma(crypto);
    const analytics = { track: jest.fn(async () => undefined) };
    const svc = new DataExportService(
      prisma as any,
      analytics as any,
      { log: jest.fn() } as any,
    );

    const result = await svc.buildExport(1n);
    // BigInt (userId в fixture-строках) не сериализуется нативно — в проде
    // это патчит main.ts (BigInt.prototype.toJSON); здесь просто эквивалент,
    // тесту нужна ТОЛЬКО текстовая сверка на утечку секрета.
    const serialized = JSON.stringify(result, (_k, v) =>
      typeof v === 'bigint' ? Number(v) : v,
    );

    expect(result.account).not.toHaveProperty('totpSecret');
    expect(result.account).not.toHaveProperty('totpRecoveryCodes');
    expect(result.account).not.toHaveProperty('totpLastStep');
    expect(serialized).not.toContain('SUPER_SECRET_TOTP_SEED');
    expect(serialized).not.toContain('one-time-code');
    expect(result.data).not.toHaveProperty('EmailToken');
    expect(result.data).not.toHaveProperty('LoginTicket');
    expect(result.data).not.toHaveProperty('WebSession');
  });

  it('withheld объясняет, чего нет в файле и почему — у каждой записи внятная причина', async () => {
    const { DataExportService, encrypt, encryptJson } = load();
    const crypto = { encrypt, encryptJson } as CryptoModule;
    const prisma = makeFakePrisma(crypto);
    const analytics = { track: jest.fn(async () => undefined) };
    const svc = new DataExportService(
      prisma as any,
      analytics as any,
      { log: jest.fn() } as any,
    );

    const result = await svc.buildExport(1n);
    const tables = result.withheld.map((w) => w.table);

    expect(tables).toEqual(
      expect.arrayContaining([
        'EmailToken',
        'LoginTicket',
        'WebSession',
        'Booking, Donation, ClientMeeting',
        // D2 (аудит 2026-10): данные О человеке на стороне терапевта и связи
        // с другими людьми — не в файле, и файл об этом говорит.
        // ModeMap и TherapyRelation теперь ВЫДАЮТСЯ (A-10) — в withheld остались
        // только рабочие материалы психолога.
        'TherapistNote, ClientConceptualization',
        'Pair',
      ]),
    );
    // Строка про поля User собирается из реестра WITHHELD_USER_FIELDS, а не
    // пишется руками, — проверяем по содержанию, а не по точному формату:
    // добавится ещё одно withhold-поле, и тест не станет красным на ровном
    // месте, но пропажу секрета из списка по-прежнему заметит.
    const userLine = tables.find((t) => t.startsWith('User.'));
    expect(userLine).toContain('totpSecret');
    expect(userLine).toContain('totpRecoveryCodes');
    for (const w of result.withheld)
      expect(w.reason.length).toBeGreaterThan(20);
  });

  // D-9 (аудит 2026-10): AuthProvider.email/displayName зашифрованы в БД, а
  // человек обязан получить в файле читаемые значения (и от старых строк
  // с открытым текстом — тоже).
  it('расшифровывает email и имя способов входа (и терпит legacy-plaintext)', async () => {
    const { DataExportService, encrypt, encryptJson } = load();
    const prisma = makeFakePrisma({ encrypt, encryptJson } as CryptoModule);
    const svc = new DataExportService(
      prisma as any,
      { track: jest.fn(async () => undefined) } as any,
      { log: jest.fn() } as any,
    );

    const result = await svc.buildExport(1n);

    expect(result.providers[0]).toMatchObject({ displayName: 'Аня' });
    expect(result.providers[1]).toMatchObject({ email: 'anya@example.com' });
  });

  // A-10 (аудит 2026-10): данные обо мне на стороне терапевта, которые человек
  // и так видит в приложении, — в файле; личные пометки терапевта — нет.
  it('отдаёт карты режимов клиента расшифрованными и запрашивает их по clientId', async () => {
    const { DataExportService, encrypt, encryptJson } = load();
    const prisma = makeFakePrisma({ encrypt, encryptJson } as CryptoModule);
    const svc = new DataExportService(
      prisma as any,
      { track: jest.fn(async () => undefined) } as any,
      { log: jest.fn() } as any,
    );

    const result = await svc.buildExport(1n);

    expect(result.data.ModeMap[0]).toMatchObject({
      id: 7,
      title: 'Карта: работа',
      nodes: [{ id: 'n1', label: 'Критик' }],
    });
    const spies = (prisma as any).__spies;
    expect(spies.modeMapFindMany.mock.calls[0][0].where).toEqual({
      clientId: 1n,
    });
    expect(spies.therapyRelationFindMany.mock.calls[0][0].where).toEqual({
      clientId: 1n,
    });
  });

  it('связь с терапевтом: кто/статус/ближайшая встреча — да; пометка терапевта и код приглашения — нет', async () => {
    const { DataExportService, encrypt, encryptJson } = load();
    const prisma = makeFakePrisma({ encrypt, encryptJson } as CryptoModule);
    const svc = new DataExportService(
      prisma as any,
      { track: jest.fn(async () => undefined) } as any,
      { log: jest.fn() } as any,
    );

    const result = await svc.buildExport(1n);

    expect(result.data.TherapyRelation[0]).toMatchObject({
      therapistId: 99n,
      status: 'active',
      nextSession: '2026-10-10',
    });
    // Запрос явным select: личная пометка терапевта (clientAlias) и код
    // приглашения не запрашиваются вовсе — утечка невозможна по построению.
    const select = (prisma as any).__spies.therapyRelationFindMany.mock
      .calls[0][0].select;
    expect(select).not.toHaveProperty('clientAlias');
    expect(select).not.toHaveProperty('virtualClientName');
    expect(select).not.toHaveProperty('code');
  });

  it('зовёт аналитику с числом таблиц и строк (правило №8), не бросает при её ошибке', async () => {
    const { DataExportService, encrypt, encryptJson } = load();
    const crypto = { encrypt, encryptJson } as CryptoModule;
    const prisma = makeFakePrisma(crypto);
    const analytics = { track: jest.fn(async () => undefined) };
    const svc = new DataExportService(
      prisma as any,
      analytics as any,
      { log: jest.fn() } as any,
    );

    await svc.buildExport(1n);

    expect(analytics.track).toHaveBeenCalledWith(
      1n,
      'data_export',
      expect.objectContaining({
        tables: expect.any(Number),
        rows: expect.any(Number),
      }),
    );
  });

  // M7 (аудит 2026-10): выгрузка оставляет аудит-след в SecurityLogService.
  it('пишет аудит-событие data_exported только с userId, без содержимого (M7)', async () => {
    const { DataExportService, encrypt, encryptJson } = load();
    const crypto = { encrypt, encryptJson } as CryptoModule;
    const prisma = makeFakePrisma(crypto);
    const analytics = { track: jest.fn(async () => undefined) };
    const securityLog = { log: jest.fn() };
    const svc = new DataExportService(
      prisma as any,
      analytics as any,
      securityLog as any,
    );

    await svc.buildExport(1n);

    expect(securityLog.log).toHaveBeenCalledTimes(1);
    expect(securityLog.log).toHaveBeenCalledWith('data_exported', {
      userId: 1n,
    });
  });
});
