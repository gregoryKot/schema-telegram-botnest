// Аудит терапевт↔клиент 2026-10: T4 и T7 для обзора заданий терапевта.
//  T4 — getTasksForClient держал свою копию проверки связи без `clientId: null`:
//       -id связи РЕАЛЬНОГО клиента отдавал «теневой» бакет заданий;
//  T7 — в списке заданий по всем клиентам имя клиента показывалось
//       зашифрованным (clientAlias / virtualClientName лежат в БД шифротекстом).
// Шифрование подменяем видимым: без ENCRYPTION_KEY настоящий encrypt отдаёт
// текст как есть, и тест «имя расшифровано» ничего бы не доказывал.
jest.mock('../utils/crypto', () => ({
  encrypt: (s: string) => `ENC(${Buffer.from(s).toString('base64')})`,
  decrypt: (s: string | null) => {
    if (s == null) return null;
    const m = /^ENC\((.*)\)$/.exec(s);
    return m ? Buffer.from(m[1], 'base64').toString('utf8') : s;
  },
}));

import { TherapyTasksViewService } from './therapy-tasks-view.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { encrypt } from '../utils/crypto';

const T1 = 100n;
const CLIENT = 555n;

const task = (userId: bigint, text: string) => ({
  id: 1,
  userId,
  assignedBy: T1,
  type: 'custom',
  text: encrypt(text),
  targetDays: null,
  needId: null,
  dueDate: null,
  done: null,
  completedAt: null,
  createdAt: new Date(),
});

function makeService(relations: any[], tasks: any[]) {
  const eq = (r: any, w: any) =>
    Object.entries(w).every(([k, v]) =>
      v && typeof v === 'object' && 'in' in v
        ? (v as { in: unknown[] }).in.includes(r[k])
        : r[k] === v,
    );
  const prisma: any = {
    therapyRelation: {
      findFirst: async ({ where }: any) =>
        relations.find((r) => eq(r, where)) ?? null,
      findMany: async ({ where }: any) =>
        relations
          .filter((r) => eq(r, where))
          .map((r) => ({
            ...r,
            client: r.clientId
              ? { id: r.clientId, firstName: r.clientName ?? null }
              : null,
          })),
    },
    userTask: {
      findMany: async ({ where }: any) => tasks.filter((t) => eq(t, where)),
    },
    user: { findUnique: async () => ({ notifyTimezone: 'Europe/Moscow' }) },
    rating: { count: async () => 0 },
    schemaDiaryEntry: { count: async () => 0 },
    modeDiaryEntry: { count: async () => 0 },
    gratitudeDiaryEntry: { count: async () => 0 },
  };
  const relationsService = new TherapyRelationsService(prisma, {} as any);
  return new TherapyTasksViewService(
    prisma,
    { getStreakProgress: async () => 0 } as any,
    relationsService,
  );
}

describe('T4 — getTasksForClient: -id связи реального клиента не виртуальный', () => {
  const realRel = {
    id: 7,
    therapistId: T1,
    clientId: CLIENT,
    status: 'active',
  };

  it('-realRel.id → null (контроллер ответит 403), задания бакета -7 не отдаются', async () => {
    const service = makeService(
      [realRel],
      [task(-7n, 'чужое теневое задание')],
    );
    expect(await service.getTasksForClient(T1, -7)).toBeNull();
  });

  it('настоящий виртуальный клиент по-прежнему получает свои задания', async () => {
    const virtual = {
      id: 8,
      therapistId: T1,
      clientId: null,
      status: 'active',
      virtualClientName: encrypt('Офлайн'),
    };
    const service = makeService([virtual], [task(-8n, 'своё задание')]);
    const res = await service.getTasksForClient(T1, -8);
    expect(res?.map((t) => t.text)).toEqual(['своё задание']);
  });
});

describe('T7 — getAllTasksForTherapist расшифровывает имена клиентов', () => {
  it('алиас реального и имя виртуального клиента — открытым текстом, не шифротекстом', async () => {
    const relations = [
      {
        id: 1,
        therapistId: T1,
        clientId: CLIENT,
        status: 'active',
        clientAlias: encrypt('Аня (алиас)'),
        clientName: 'Anna',
      },
      {
        id: 2,
        therapistId: T1,
        clientId: null,
        status: 'active',
        clientAlias: null,
        virtualClientName: encrypt('Офлайн Борис'),
      },
    ];
    const service = makeService(relations, [
      task(CLIENT, 'задание Ане'),
      task(-2n, 'задание Борису'),
    ]);
    const res = await service.getAllTasksForTherapist(T1);
    const names = Object.fromEntries(
      res.map((r) => [r.clientId, r.clientName]),
    );
    expect(names[Number(CLIENT)]).toBe('Аня (алиас)');
    expect(names[-2]).toBe('Офлайн Борис');
    expect(JSON.stringify(res.map((r) => r.clientName))).not.toContain('ENC(');
  });

  it('без алиаса — имя из профиля, как раньше', async () => {
    const service = makeService(
      [
        {
          id: 1,
          therapistId: T1,
          clientId: CLIENT,
          status: 'active',
          clientAlias: null,
          clientName: 'Anna',
        },
      ],
      [task(CLIENT, 'x')],
    );
    const [only] = await service.getAllTasksForTherapist(T1);
    expect(only.clientName).toBe('Anna');
  });
});
