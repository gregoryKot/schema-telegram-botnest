// Карты режимов в выгрузке клиента — тем же видом, что «Мои карты»: только
// карты видимых авторов, узел колеса без листа, оценки колеса рядом.
import { exportClientSide } from './data-export.client-side';
import { encryptNeedLinks } from '../therapy/concept-need-links';
import { encryptRecord } from '../utils/crypto';
import { MODE_MAP_SCHEMA } from '../therapy/client-mode-map';
import { CLIENT_LEFT } from '../therapy/relation-end-reason';

const CLIENT = 555n;
const ACTIVE = 100n;
const LEFT = 200n;

const wheelNode = {
  id: 'w',
  type: 'needs',
  data: {
    label: 'Потребности',
    wheel: { period: 'now', notes: { now: 'ЛИСТ КОЛЕСА' } },
  },
};

const map = (id: number, therapistId: bigint, title: string) => ({
  id,
  therapistId,
  clientId: CLIENT,
  kind: 'problem',
  updatedAt: new Date('2026-11-10T09:00:00Z'),
  ...encryptRecord({ title, nodes: [wheelNode], edges: [] }, MODE_MAP_SCHEMA),
});

function makePrisma() {
  const maps = [map(1, ACTIVE, 'МОЯ КАРТА'), map(2, LEFT, 'КАРТА УШЕДШЕГО')];
  const rels = [
    { therapistId: ACTIVE, status: 'active', endReason: null },
    { therapistId: LEFT, status: 'ended', endReason: CLIENT_LEFT },
  ];
  return {
    modeMap: {
      findMany: jest.fn(
        ({ where }: { where: { therapistId: { in: bigint[] } } }) =>
          Promise.resolve(
            maps.filter((m) => where.therapistId.in.includes(m.therapistId)),
          ),
      ),
    },
    therapyRelation: { findMany: jest.fn(async () => rels) },
    clientConceptualization: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => ({
        needLinks: encryptNeedLinks([
          {
            needId: 'attachment',
            ratings: { now: 7 },
            notes: { now: 'ЗАМЕТКА ТЕРАПЕВТА' },
          },
        ]),
      })),
    },
    therapistNote: { findMany: jest.fn(async () => []) },
  };
}

describe('exportClientSide — карты режимов', () => {
  it('отдаёт видимые клиенту карты видом приложения: оценки колеса есть, листа нет', async () => {
    const out = await exportClientSide(makePrisma(), CLIENT);
    expect(out.data.ModeMap).toEqual([
      expect.objectContaining({
        id: 1,
        title: 'МОЯ КАРТА',
        nodes: [
          {
            ...wheelNode,
            data: { ...wheelNode.data, wheel: { period: 'now' } },
          },
        ],
        needRatings: [{ needId: 'attachment', ratings: { now: 7 } }],
      }),
    ]);
    const text = JSON.stringify(out.data.ModeMap, (_k, v: unknown) =>
      typeof v === 'bigint' ? String(v) : v,
    );
    for (const secret of ['ЛИСТ КОЛЕСА', 'ЗАМЕТКА ТЕРАПЕВТА', 'КАРТА УШЕДШЕГО'])
      expect(text).not.toContain(secret);
  });
});
