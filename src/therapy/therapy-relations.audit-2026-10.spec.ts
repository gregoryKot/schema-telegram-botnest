// Аудит терапевт↔клиент 2026-10: регрессии T2–T5 на связи.
//  T2 — DELETE /relation от терапевта сносил всех его клиентов и приглашения;
//  T3 — клиент мог невидимо подключиться ко второму терапевту;
//  T4 — -id связи РЕАЛЬНОГО клиента проходил как «виртуальный» клиент;
//  T5 — код-приглашение без срока, неатомарный захват, новая строка на вызов.
// Фейк Prisma (therapy.test-helpers.ts) честно разбирает `{ not }`, `{ gte }` и
// `clientId: null` — мок, который их игнорирует, не проверял бы ни одно условие.
import { ALREADY_CONNECTED_ERROR, INVITE_TTL_MS } from './therapy-invite';
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';

const T1 = 100n;
const T2 = 200n;
const CLIENT = 555n;

function make(rels: Rel[]) {
  const prisma: any = makeRelationPrismaMock(rels);
  return { service: new TherapyRelationsService(prisma, {} as any), rels };
}

const pending = (over: Partial<Rel> = {}): Rel => ({
  id: 10,
  therapistId: T1,
  clientId: null,
  status: 'pending',
  code: 'FRESH1',
  createdAt: new Date(),
  ...over,
});

describe('T2 — disconnect не трогает связи в роли терапевта', () => {
  it('терапевт вызывает disconnect: его клиенты, офлайн-клиенты и приглашения целы', async () => {
    const real: Rel = {
      id: 1,
      therapistId: T1,
      clientId: CLIENT,
      status: 'active',
      code: 'AAA111',
    };
    const virtual: Rel = {
      id: 2,
      therapistId: T1,
      clientId: null,
      status: 'active',
      code: 'BBB222',
    };
    const invite = pending({ id: 3, code: 'CCC333' });
    const { service, rels } = make([real, virtual, invite]);
    await service.disconnect(T1);
    expect(rels).toEqual([real, virtual, invite]);
  });

  it('клиент disconnect: рвёт все свои связи (с любым терапевтом), чужие не трогает', async () => {
    const mine1: Rel = {
      id: 1,
      therapistId: T1,
      clientId: CLIENT,
      status: 'active',
      code: 'A1',
    };
    const mine2: Rel = {
      id: 2,
      therapistId: T2,
      clientId: CLIENT,
      status: 'active',
      code: 'A2',
    };
    const other: Rel = {
      id: 3,
      therapistId: T1,
      clientId: 777n,
      status: 'active',
      code: 'A3',
    };
    const { service, rels } = make([mine1, mine2, other]);
    await service.disconnect(CLIENT);
    expect(rels).toEqual([other]);
  });
});

describe('T3 — клиент не подключается ко второму терапевту', () => {
  const activeWithT2: Rel = {
    id: 1,
    therapistId: T2,
    clientId: CLIENT,
    status: 'active',
    code: 'AAA111',
  };

  it('активная связь с ДРУГИМ терапевтом → ALREADY_CONNECTED, код не захвачен', async () => {
    const invite = pending();
    const { service } = make([activeWithT2, invite]);
    await expect(service.joinAsClient(CLIENT, 'fresh1')).rejects.toThrow(
      ALREADY_CONNECTED_ERROR,
    );
    expect(invite.status).toBe('pending');
    expect(invite.clientId).toBeNull();
  });

  it('связи с другим терапевтом нет → подключение проходит', async () => {
    const invite = pending();
    const { service } = make([invite]);
    await expect(service.joinAsClient(CLIENT, 'FRESH1')).resolves.toBe(true);
    expect(invite.status).toBe('active');
    expect(invite.clientId).toBe(CLIENT);
  });

  it('pending-связь клиента с другим терапевтом (код не принят) — не мешает', async () => {
    const { service } = make([
      { ...activeWithT2, status: 'pending', clientId: null },
      pending(),
    ]);
    await expect(service.joinAsClient(CLIENT, 'FRESH1')).resolves.toBe(true);
  });
});

describe('T4 — виртуальная ветка требует clientId: null', () => {
  const realRel: Rel = {
    id: 7,
    therapistId: T1,
    clientId: CLIENT,
    status: 'active',
    code: 'REAL07',
  };
  const virtualRel: Rel = {
    id: 8,
    therapistId: T1,
    clientId: null,
    status: 'active',
    code: 'VIRT08',
  };

  it('assertHasClient(-realRel.id) отвергается, настоящий виртуальный проходит', async () => {
    const { service } = make([realRel, virtualRel]);
    await expect(service.assertHasClient(T1, -7n)).rejects.toThrow(
      'No active relation',
    );
    await expect(service.assertHasClient(T1, -8n)).resolves.toBeUndefined();
  });

  it('renameClient(-realRel.id) не переименовывает реального клиента', async () => {
    const { service, rels } = make([{ ...realRel }, virtualRel]);
    await service.renameClient(T1, -7n, 'теневой алиас');
    expect((rels[0] as any).clientAlias).toBeUndefined();
    await service.renameClient(T1, -8n, 'виртуальный');
    expect((rels[1] as any).clientAlias).toBe('виртуальный');
  });
});

describe('T5 — коды-приглашения', () => {
  it('просроченный (старше 7 дней) pending-код не принимается', async () => {
    const stale = pending({
      createdAt: new Date(Date.now() - INVITE_TTL_MS - 60_000),
    });
    const { service } = make([stale]);
    await expect(service.joinAsClient(CLIENT, 'FRESH1')).resolves.toBe(false);
    expect(stale.status).toBe('pending');
  });

  it('код чуть моложе недели ещё действует', async () => {
    const { service } = make([
      pending({ createdAt: new Date(Date.now() - INVITE_TTL_MS + 60_000) }),
    ]);
    await expect(service.joinAsClient(CLIENT, 'FRESH1')).resolves.toBe(true);
  });

  it('захват атомарный: код, занятый между чтением и записью, не достаётся второму клиенту', async () => {
    const invite = pending();
    const prisma: any = makeRelationPrismaMock([invite]);
    // Между findUnique и updateMany код уже занял другой клиент.
    const realFindUnique = prisma.therapyRelation.findUnique;
    prisma.therapyRelation.findUnique = async (args: any) => {
      const snapshot = await realFindUnique(args);
      invite.clientId = 999n;
      invite.status = 'active';
      return snapshot;
    };
    const service = new TherapyRelationsService(prisma, {} as any);
    await expect(service.joinAsClient(CLIENT, 'FRESH1')).resolves.toBe(false);
    expect(invite.clientId).toBe(999n); // победитель не затёрт
  });

  it('createInvite повторно отдаёт свежий неиспользованный код, новую строку не создаёт', async () => {
    const { service, rels } = make([]);
    const first = await service.createInvite(T1);
    const second = await service.createInvite(T1);
    expect(second.code).toBe(first.code);
    expect(rels).toHaveLength(1);
  });

  it('createInvite: код другого терапевта не переиспользуется', async () => {
    const { service, rels } = make([pending({ therapistId: T2 })]);
    const mine = await service.createInvite(T1);
    expect(mine.code).not.toBe('FRESH1');
    expect(rels).toHaveLength(2);
  });

  it('createInvite: просроченный или уже принятый код не переиспользуется', async () => {
    const { service, rels } = make([
      pending({ id: 1, code: 'OLD001', createdAt: new Date(0) }),
      pending({
        id: 2,
        code: 'USED02',
        status: 'active',
        clientId: CLIENT,
      }),
    ]);
    const res = await service.createInvite(T1);
    expect(['OLD001', 'USED02']).not.toContain(res.code);
    expect(rels).toHaveLength(3);
  });
});
