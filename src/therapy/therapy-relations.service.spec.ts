// Тесты на границу доступа терапевта (аудит 2026-07, этап 2а):
// assertRelation — единственный барьер между терапевтом и клиническими
// данными ЧУЖИХ клиентов; до этого файла он не был покрыт ни одним тестом.
// Плюс: правила joinAsClient. (Перенесено из therapy.authz.spec.ts при
// распиле TherapyService — 2д REMEDIATION_PLAN; conceptualization-тесты
// уехали в therapy-notes.service.spec.ts.)
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';

// Ключ шифрования не задан (dev-режим crypto.ts) — encrypt() возвращает
// plaintext, что для этих тестов и нужно.

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
});
