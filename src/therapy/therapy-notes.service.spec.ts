// saveConceptualization — history-версионирование (read-after-write по
// денормализованному history-массиву, аудит 2026-07, 2.3). Перенесено из
// therapy.authz.spec.ts при распиле TherapyService — 2д REMEDIATION_PLAN.
// assertRelation-граница проверяется отдельно в
// therapy-relations.service.spec.ts; здесь используется реальный
// TherapyRelationsService поверх той же фейковой Prisma, чтобы не
// дублировать текст проверки.
import { TherapyNotesService } from './therapy-notes.service';
import { TherapyRelationsService } from './therapy-relations.service';
import {
  CONCEPT_HISTORY_MAX,
  CONCEPT_SNAPSHOT_COALESCE_MS,
} from './concept-history';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';

function makeService(rels: Rel[], conceptRow: any = null) {
  const concept = { row: conceptRow };
  const prisma: any = {
    ...makeRelationPrismaMock(rels),
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
  const relationsService = new TherapyRelationsService(prisma, {} as any);
  const service = new TherapyNotesService(prisma, relationsService);
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

describe('saveConceptualization — history-версионирование', () => {
  it('первое сохранение — history пустой; второе кладёт снапшот прежнего состояния', async () => {
    const { service, concept } = makeService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, {
      goals: 'v1',
    });
    expect(concept.row.history).toEqual([]);

    await service.saveConceptualization(T1, CLIENT, {
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
    await service.saveConceptualization(T1, CLIENT, { goals: 'new' });
    expect(concept.row.history).toHaveLength(20);
    expect(concept.row.history[0].goals).toBe('current'); // свежий снапшот вытеснил самый старый
    expect(concept.row.history.at(-1).goals).toBe('old18');
  });

  it('чужой терапевт не может писать конспектуализацию', async () => {
    const { service } = makeService([activeRel]);
    await expect(
      service.saveConceptualization(T2, CLIENT, { goals: 'x' }),
    ).rejects.toThrow('No active relation');
  });
});

// Аудит 2026-10, «Долг с механизмом»: сайт автосохраняет концептуализацию
// через 700 мс после каждой правки, и снимок на каждый save за десять минут
// печати вытеснял из 20 слотов все версии, включая месячную. Снимок «до»
// берётся один раз в начале сессии правки — окно склейки 30 минут.
describe('saveConceptualization — автосохранение не выжигает историю', () => {
  const T0 = Date.parse('2026-10-01T10:00:00.000Z');
  const MIN = 60_000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(T0);
  });
  afterEach(() => jest.useRealTimers());

  async function autosaveSeries(
    service: TherapyNotesService,
    count: number,
  ): Promise<void> {
    for (let i = 1; i <= count; i++) {
      jest.setSystemTime(Date.now() + 30_000);
      await service.saveConceptualization(T1, CLIENT, { goals: `draft${i}` });
    }
  }

  it('25 автосохранений с шагом 30 с — один снимок, исходная версия на месте', async () => {
    const { service, concept } = makeService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { goals: 'v0' });
    await autosaveSeries(service, 25);

    expect(concept.row.history).toHaveLength(1);
    expect(concept.row.history[0].goals).toBe('v0');
    expect(concept.row.history[0].savedAt).toBe(
      new Date(T0 + 30_000).toISOString(),
    );
    expect(concept.row.goals).toBe('draft25');
  });

  it('save через 31 мин после серии кладёт новый снимок с последним состоянием серии', async () => {
    const { service, concept } = makeService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { goals: 'v0' });
    await autosaveSeries(service, 25);

    jest.setSystemTime(Date.now() + 31 * MIN);
    await service.saveConceptualization(T1, CLIENT, { goals: 'next' });

    expect(concept.row.history).toHaveLength(2);
    expect(concept.row.history[0].goals).toBe('draft25');
    expect(concept.row.history[1].goals).toBe('v0');
  });

  it('граница окна: за 1 мс до конца склеивается, ровно на границе — снимок', async () => {
    const snapAt = new Date(
      T0 - CONCEPT_SNAPSHOT_COALESCE_MS + 1,
    ).toISOString();
    const row = () => ({
      therapistId: T1,
      clientId: CLIENT,
      goals: 'current',
      history: [{ savedAt: snapAt, goals: 'before' }],
    });

    const inside = makeService([activeRel], row());
    await inside.service.saveConceptualization(T1, CLIENT, { goals: 'x' });
    expect(inside.concept.row.history.map((h: any) => h.goals)).toEqual([
      'before',
    ]);

    jest.setSystemTime(T0 + 1);
    const edge = makeService([activeRel], row());
    await edge.service.saveConceptualization(T1, CLIENT, { goals: 'x' });
    expect(edge.concept.row.history.map((h: any) => h.goals)).toEqual([
      'current',
      'before',
    ]);
  });

  it('снимок с savedAt из будущего (часы инстанса разошлись) историю не замораживает', async () => {
    const { service, concept } = makeService([activeRel], {
      therapistId: T1,
      clientId: CLIENT,
      goals: 'current',
      history: [{ savedAt: new Date(T0 + 5 * MIN).toISOString(), goals: 'f' }],
    });
    await service.saveConceptualization(T1, CLIENT, { goals: 'x' });
    expect(concept.row.history.map((h: any) => h.goals)).toEqual([
      'current',
      'f',
    ]);
  });

  it('неразбираемый или отсутствующий savedAt историю не замораживает', async () => {
    for (const legacy of [{ savedAt: '2026-10-14x' }, { savedAt: 42 }, {}]) {
      const { service, concept } = makeService([activeRel], {
        therapistId: T1,
        clientId: CLIENT,
        goals: 'current',
        history: [legacy],
      });
      await service.saveConceptualization(T1, CLIENT, { goals: 'x' });
      expect(concept.row.history).toHaveLength(2);
      expect(concept.row.history[0].goals).toBe('current');
    }
  });

  it('потолок 20 держится и для ISO-снимков старше окна', async () => {
    const full = Array.from({ length: CONCEPT_HISTORY_MAX }, (_, i) => ({
      savedAt: new Date(T0 - (i + 1) * 24 * 60 * MIN).toISOString(),
      goals: `old${i}`,
    }));
    const { service, concept } = makeService([activeRel], {
      therapistId: T1,
      clientId: CLIENT,
      goals: 'current',
      history: full,
    });
    await service.saveConceptualization(T1, CLIENT, { goals: 'new' });
    expect(concept.row.history).toHaveLength(CONCEPT_HISTORY_MAX);
    expect(concept.row.history[0].goals).toBe('current');
    expect(concept.row.history[0].savedAt).toBe(new Date(T0).toISOString());
    expect(concept.row.history.at(-1).goals).toBe('old18');
  });

  it('сохранил серию → GET отдаёт ту же историю (read-after-write)', async () => {
    const { service } = makeService([activeRel]);
    await service.saveConceptualization(T1, CLIENT, { goals: 'v0' });
    await autosaveSeries(service, 25);
    const saved = await service.saveConceptualization(T1, CLIENT, {
      goals: 'last',
    });

    const loaded = await service.getConceptualization(T1, CLIENT);
    expect(loaded!.goals).toBe('last');
    expect(loaded!.history).toHaveLength(1);
    expect(loaded!.history[0].goals).toBe('v0');
    expect(loaded!.history).toEqual(saved.history);
  });
});
