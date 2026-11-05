// Перенос данных офлайн-карточки на аккаунт при подключении по приглашению из
// карточки. Мок Prisma в стиле therapy-invite.spec.ts; живой проход — e2e
// test/therapy-invite-attach.e2e-spec.ts.
import { readFileSync } from 'fs';
import { join } from 'path';
import type { PrismaService } from '../prisma/prisma.service';
import { attachOfflineCard } from './therapy-invite-attach';

const TH = 1n;
const CLIENT = 50n;
const old = new Date('2026-01-01T00:00:00Z');
const recent = new Date('2026-06-01T00:00:00Z');

interface Opts {
  card?: Record<string, unknown> | null;
  target?: Record<string, unknown> | null;
  offlineConc?: { id: number; updatedAt: Date } | null;
  existingConc?: { id: number; updatedAt: Date } | null;
}

function make(o: Opts) {
  const calls: string[] = [];
  const rec = (name: string, ret?: unknown) =>
    jest.fn((..._a: unknown[]) => {
      calls.push(name);
      return Promise.resolve(ret);
    });
  const card =
    o.card === undefined
      ? {
          id: 7,
          virtualClientName: 'enc:card',
          therapyStartDate: '2026-02-02',
          nextSession: '2026-12-01',
          meetingDays: [1, 3],
        }
      : o.card;
  const target =
    o.target === undefined
      ? {
          id: 100,
          clientAlias: null,
          therapyStartDate: null,
          nextSession: null,
          meetingDays: [],
        }
      : o.target;
  const conc = jest.fn(async (args: { where: { clientId: bigint } }) =>
    args.where.clientId === -7n
      ? (o.offlineConc ?? null)
      : (o.existingConc ?? null),
  );
  const tx = {
    therapyRelation: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(card)
        .mockResolvedValueOnce(target),
      update: rec('rel.update'),
      deleteMany: rec('rel.deleteMany'),
      delete: rec('rel.delete'),
    },
    userTask: { updateMany: rec('task.updateMany') },
    therapistNote: { updateMany: rec('note.updateMany') },
    modeMap: { updateMany: rec('map.updateMany') },
    clientConceptualization: {
      findFirst: conc,
      update: rec('conc.update'),
      delete: rec('conc.delete'),
    },
  };
  const prisma = {
    $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
  } as unknown as PrismaService;
  return { tx, prisma, calls };
}

describe('attachOfflineCard', () => {
  it('задания, заметки и карты переезжают с -R на аккаунт в одной транзакции', async () => {
    const { tx, prisma } = make({});
    expect(await attachOfflineCard(prisma, TH, CLIENT, 7)).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userTask.updateMany).toHaveBeenCalledWith({
      where: { userId: -7n, assignedBy: TH },
      data: { userId: CLIENT },
    });
    for (const d of [tx.therapistNote, tx.modeMap])
      expect(d.updateMany).toHaveBeenCalledWith({
        where: { therapistId: TH, clientId: -7n },
        data: { clientId: CLIENT },
      });
  });

  it('концептуализация только на карточке — переводится на аккаунт', async () => {
    const { tx, prisma } = make({ offlineConc: { id: 1, updatedAt: old } });
    await attachOfflineCard(prisma, TH, CLIENT, 7);
    expect(tx.clientConceptualization.delete).not.toHaveBeenCalled();
    expect(tx.clientConceptualization.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { clientId: CLIENT },
    });
  });

  it('обе есть, карточка новее — existing удалена, карточка переведена', async () => {
    const { tx, prisma, calls } = make({
      offlineConc: { id: 1, updatedAt: recent },
      existingConc: { id: 2, updatedAt: old },
    });
    await attachOfflineCard(prisma, TH, CLIENT, 7);
    expect(tx.clientConceptualization.delete).toHaveBeenCalledWith({
      where: { id: 2 },
    });
    expect(tx.clientConceptualization.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { clientId: CLIENT },
    });
    expect(calls.indexOf('conc.delete')).toBeLessThan(
      calls.indexOf('conc.update'),
    );
  });

  it.each([
    ['existing новее', old, recent],
    ['равны', recent, recent],
  ])('обе есть, %s — карточная удалена', async (_n, off, ex) => {
    const { tx, prisma } = make({
      offlineConc: { id: 1, updatedAt: off },
      existingConc: { id: 2, updatedAt: ex },
    });
    await attachOfflineCard(prisma, TH, CLIENT, 7);
    expect(tx.clientConceptualization.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(tx.clientConceptualization.update).not.toHaveBeenCalled();
  });

  it('поля связи копируются в пустые, заполненные не затираются', async () => {
    const empty = make({});
    await attachOfflineCard(empty.prisma, TH, CLIENT, 7);
    expect(empty.tx.therapyRelation.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: {
        attachToId: null,
        clientAlias: 'enc:card',
        therapyStartDate: '2026-02-02',
        nextSession: '2026-12-01',
        meetingDays: [1, 3],
      },
    });
    const full = make({
      target: {
        id: 100,
        clientAlias: 'enc:own',
        therapyStartDate: '2025-05-05',
        nextSession: '2026-11-20',
        meetingDays: [5],
      },
    });
    await attachOfflineCard(full.prisma, TH, CLIENT, 7);
    expect(full.tx.therapyRelation.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: {
        attachToId: null,
        clientAlias: 'enc:own',
        therapyStartDate: '2025-05-05',
        nextSession: '2026-11-20',
        meetingDays: [5],
      },
    });
  });

  it('attachToId: null на целевой строке ставится ДО удаления карточки', async () => {
    const m = make({});
    await attachOfflineCard(m.prisma, TH, CLIENT, 7);
    expect(m.calls.indexOf('rel.update')).toBeLessThan(
      m.calls.indexOf('rel.deleteMany'),
    );
    expect(m.calls.indexOf('rel.deleteMany')).toBeLessThan(
      m.calls.indexOf('rel.delete'),
    );
    expect(m.tx.therapyRelation.deleteMany).toHaveBeenCalledWith({
      where: { attachToId: 7 },
    });
    expect(m.tx.therapyRelation.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });
  });

  it('нет карточки → false, ничего не пишется', async () => {
    const { tx, prisma } = make({ card: null });
    expect(await attachOfflineCard(prisma, TH, CLIENT, 7)).toBe(false);
    expect(tx.userTask.updateMany).not.toHaveBeenCalled();
    expect(tx.therapyRelation.delete).not.toHaveBeenCalled();
  });

  it('нет активной связи с клиентом → false, ничего не пишется', async () => {
    const { tx, prisma } = make({ target: null });
    expect(await attachOfflineCard(prisma, TH, CLIENT, 7)).toBe(false);
    expect(tx.therapistNote.updateMany).not.toHaveBeenCalled();
    expect(tx.therapyRelation.delete).not.toHaveBeenCalled();
  });
});

// Правило №4: каждая таблица с парой therapistId+clientId переезжает.
describe('attachOfflineCard: покрытие моделей схемы', () => {
  const schema = readFileSync(
    join(__dirname, '../../prisma/schema.prisma'),
    'utf8',
  );
  const source = readFileSync(
    join(__dirname, './therapy-invite-attach.ts'),
    'utf8',
  );
  const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
    .filter(
      ([, , body]) =>
        /^\s+therapistId\s+BigInt\b/m.test(body) &&
        /^\s+clientId\s+BigInt\??\s/m.test(body),
    )
    .map(([, name]) => name)
    .filter((n) => n !== 'TherapyRelation');

  it('находит известные модели (проверка самого поиска)', () => {
    expect(models).toEqual(
      expect.arrayContaining([
        'TherapistNote',
        'ClientConceptualization',
        'ModeMap',
      ]),
    );
  });

  it.each(models)('%s переносится в attachOfflineCard', (model) => {
    const delegate = model[0].toLowerCase() + model.slice(1);
    expect(source).toContain(`tx.${delegate}.`);
  });
});
