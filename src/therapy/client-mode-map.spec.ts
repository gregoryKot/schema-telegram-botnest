// Карта режимов глазами клиента: оценки колеса потребностей уходят вместе с
// картой, заметки листа — никогда (ни из концептуализации, ни из старого узла).
import { PrismaService } from '../prisma/prisma.service';
import { clientModeMap, clientNeedRatings } from './client-mode-map';
import { ConceptNeedLink, encryptNeedLinks } from './concept-need-links';

const T1 = 100n;
const T2 = 200n;
const CLIENT = 555n;
const STRANGER = 777n;
const SCHEMA = { strings: ['title'], jsonArrays: ['nodes', 'edges'] };

const WHEEL: ConceptNeedLink[] = [
  {
    needId: 'attachment',
    ratings: { child: 2, now: 7 },
    notes: { child: 'мама часто уезжала' },
  },
  { needId: 'play', ratings: { now: 0 }, notes: {} },
  { needId: 'limits', ratings: {}, notes: { teen: 'только заметка' } },
];
const RATINGS = [
  { needId: 'attachment', ratings: { child: 2, now: 7 } },
  { needId: 'play', ratings: { now: 0 } },
];

const wheelNode = (wheel: object = { period: 'now' }) => ({
  id: 'w',
  type: 'needs',
  position: { x: 10, y: 20 },
  data: { label: 'Потребности', wheel },
});
const MODE_NODE = { id: 'n1', type: 'child', data: { label: 'Ребёнок' } };
/** Ответ текстом, как он уйдёт по HTTP (bigint — строкой). */
const wire = (v: unknown) =>
  JSON.stringify(v, (_k, x: unknown) => (typeof x === 'bigint' ? `${x}` : x));

interface Fixture {
  nodes: unknown[];
  /** Связи клиента CLIENT: по умолчанию активная с T1. */
  rels?: { therapistId: bigint; status: string; endReason?: string }[];
  /** Колесо по терапевтам; нет ключа — строки концептуализации нет. */
  wheels?: Record<string, ConceptNeedLink[]>;
}

function setup({ nodes, rels, wheels = {} }: Fixture) {
  const map = {
    id: 1,
    therapistId: T1,
    clientId: CLIENT,
    title: 'Карта',
    kind: 'problem',
    nodes,
    edges: [],
  };
  const relRows = (rels ?? [{ therapistId: T1, status: 'active' }]).map(
    (r) => ({ endReason: null, ...r, clientId: CLIENT }),
  );
  const conceptFind = jest.fn(
    ({
      where,
    }: {
      where: { therapistId_clientId: { therapistId: bigint } };
    }) => {
      const links = wheels[String(where.therapistId_clientId.therapistId)];
      return Promise.resolve(
        links ? { needLinks: encryptNeedLinks(links) } : null,
      );
    },
  );
  const prisma = {
    modeMap: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve(where.id === map.id ? map : null),
      ),
    },
    therapyRelation: {
      findMany: jest.fn(({ where }: { where: { clientId: bigint } }) =>
        Promise.resolve(relRows.filter((r) => r.clientId === where.clientId)),
      ),
    },
    clientConceptualization: { findUnique: conceptFind },
  } as unknown as PrismaService;
  const get = (clientId: bigint = CLIENT) =>
    clientModeMap(prisma, clientId, 1, SCHEMA);
  return { get, conceptFind };
}

describe('clientNeedRatings', () => {
  it('оставляет оценки без заметок; потребность только с заметкой не попадает', () => {
    const out = clientNeedRatings(WHEEL);
    expect(out).toEqual(RATINGS);
    expect(JSON.stringify(out)).not.toMatch(/notes|мама|только заметка/);
  });
});

describe('clientModeMap', () => {
  it('карта с колесом → оценки из концептуализации, заметок листа в ответе нет', async () => {
    const { get } = setup({
      nodes: [MODE_NODE, wheelNode()],
      wheels: { [String(T1)]: WHEEL },
    });
    const map = await get();
    expect(map.needRatings).toEqual(RATINGS);
    expect(map.nodes).toEqual([MODE_NODE, wheelNode()]);
    expect(wire(map)).not.toMatch(/"notes"|мама часто уезжала|только заметка/);
  });

  it('на карте нет колеса → оценок нет и концептуализация не читается', async () => {
    const { get, conceptFind } = setup({
      nodes: [MODE_NODE],
      wheels: { [String(T1)]: WHEEL },
    });
    expect((await get()).needRatings).toEqual([]);
    expect(conceptFind).not.toHaveBeenCalled();
  });

  it('старый узел с оценками и заметками внутри → клиенту уходит только вид колеса', async () => {
    const old = wheelNode({
      period: 'teen',
      compare: true,
      ratings: { now: { attachment: 3 } },
      notes: { now: { attachment: 'старая заметка в узле' } },
    });
    const { get } = setup({ nodes: [old] });
    const map = await get();
    expect(map.nodes).toEqual([wheelNode({ period: 'teen', compare: true })]);
    expect(wire(map)).not.toMatch(/старая заметка в узле|"notes"|"ratings"/);
  });

  it('чужой клиент и клиент без связи с автором → Not found, колесо не читается', async () => {
    const wheels = { [String(T1)]: WHEEL };
    const foreign = setup({ nodes: [wheelNode()], wheels });
    await expect(foreign.get(STRANGER)).rejects.toThrow('Not found');
    expect(foreign.conceptFind).not.toHaveBeenCalled();

    const left = setup({
      nodes: [wheelNode()],
      wheels,
      rels: [{ therapistId: T1, status: 'ended', endReason: 'client_left' }],
    });
    await expect(left.get()).rejects.toThrow('Not found');
    expect(left.conceptFind).not.toHaveBeenCalled();
  });

  it('колесо берётся по паре (автор карты, клиент), а не у другого терапевта клиента', async () => {
    const { get, conceptFind } = setup({
      nodes: [wheelNode()],
      rels: [
        { therapistId: T1, status: 'active' },
        { therapistId: T2, status: 'active' },
      ],
      wheels: {
        [String(T1)]: WHEEL,
        [String(T2)]: [{ needId: 'limits', ratings: { now: 9 }, notes: {} }],
      },
    });
    expect((await get()).needRatings).toEqual(RATINGS);
    expect(conceptFind).toHaveBeenCalledTimes(1);
    expect(conceptFind.mock.calls[0][0].where).toEqual({
      therapistId_clientId: { therapistId: T1, clientId: CLIENT },
    });
  });

  it('строки концептуализации нет → оценок нет, карта отдаётся', async () => {
    const { get, conceptFind } = setup({ nodes: [wheelNode()] });
    const map = await get();
    expect(map.needRatings).toEqual([]);
    expect(map.title).toBe('Карта');
    expect(conceptFind).toHaveBeenCalledTimes(1);
  });
});
