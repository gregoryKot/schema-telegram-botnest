// Тесты на границу доступа терапевта (аудит 2026-07, этап 2а):
// assertRelation — единственный барьер между терапевтом и клиническими
// данными ЧУЖИХ клиентов; до этого файла он не был покрыт ни одним тестом.
// Плюс: правила joinAsClient и версионирование conceptualization
// (history-снапшоты, потолок 20) — read-after-write по правилам CLAUDE.md.
import { TherapyService } from './therapy.service';

// Ключ шифрования не задан (dev-режим crypto.ts) — encrypt() возвращает
// plaintext, что для этих тестов и нужно.

interface Rel {
  id: number;
  therapistId: bigint;
  clientId: bigint | null;
  status: string;
  code: string;
}

function makeService(rels: Rel[], conceptRow: any = null) {
  const concept = { row: conceptRow };
  const prisma: any = {
    therapyRelation: {
      findFirst: jest.fn(async ({ where }: any) =>
        rels.find(
          (r) =>
            (where.id === undefined || r.id === where.id) &&
            (where.therapistId === undefined ||
              r.therapistId === where.therapistId) &&
            (where.clientId === undefined || r.clientId === where.clientId) &&
            (where.status === undefined || r.status === where.status),
        ) ?? null,
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        rels.find((r) => r.code === where.code) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const r = rels.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    clientConceptualization: {
      findUnique: jest.fn(async () => concept.row),
      upsert: jest.fn(async ({ create, update }: any) => {
        concept.row = concept.row
          ? { ...concept.row, ...update }
          : { ...create };
        return concept.row;
      }),
    },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const service = new TherapyService(prisma, {} as any, {} as any);
  return { service, prisma, concept };
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
});

describe('saveConceptualization — history-версионирование', () => {
  it('первое сохранение — history пустой; второе кладёт снапшот прежнего состояния', async () => {
    const { service, concept } = makeService([activeRel]);
    await service.saveConceptualization(T1, Number(CLIENT), {
      goals: 'v1',
    });
    expect(concept.row.history).toEqual([]);

    await service.saveConceptualization(T1, Number(CLIENT), {
      goals: 'v2',
    });
    expect(concept.row.history).toHaveLength(1);
    expect(concept.row.history[0].goals).toBe('v1');
    expect(concept.row.goals).toBe('v2');
  });

  it('history не растёт бесконечно — потолок 20 снапшотов', async () => {
    const full = Array.from({ length: 20 }, (_, i) => ({
      savedAt: `t${i}`,
      goals: `old${i}`,
    }));
    const { service, concept } = makeService([activeRel], {
      therapistId: T1,
      clientId: CLIENT,
      goals: 'current',
      history: full,
    });
    await service.saveConceptualization(T1, Number(CLIENT), { goals: 'new' });
    expect(concept.row.history).toHaveLength(20);
    expect(concept.row.history[0].goals).toBe('current'); // свежий снапшот вытеснил самый старый
    expect(concept.row.history.at(-1).goals).toBe('old18');
  });

  it('чужой терапевт не может писать конспектуализацию', async () => {
    const { service } = makeService([activeRel]);
    await expect(
      service.saveConceptualization(T2, Number(CLIENT), { goals: 'x' }),
    ).rejects.toThrow('No active relation');
  });
});
