// Колесо потребностей клиента в концептуализации (concept-needs.ts) на
// фейковой Prisma под настоящим ключом шифрования. Сохранил → нашёл через
// getConceptualization (read-after-write: колесо правит холст, показывает
// вкладка «Концептуализация»); запись — replace; в «БД» шифротекст. И главное
// обещание: остальные пути записи (полное сохранение вкладки, восстановление
// версии, дописывание с холста) колесо не трогают, история его не несёт.
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';
import { loadWithKeys } from '../test-support/load-with-keys';

// Crypto-модуль разбирает ENCRYPTION_KEY при импорте: без ключа encrypt() —
// identity, и «в БД не открытый текст» ничего бы не доказывал.
const { saveConceptNeeds, appendToConcept, TherapyNotesService } = loadWithKeys(
  { key: 'ef'.repeat(32) },
  () => ({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ...(require('./concept-needs') as typeof import('./concept-needs')),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ...(require('./concept-append') as typeof import('./concept-append')),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ...(require('./therapy-notes.service') as typeof import('./therapy-notes.service')),
  }),
);

const T1 = 100n;
const T2 = 200n;
const CLIENT = 555n;
const rel: Rel = {
  id: 1,
  therapistId: T1,
  clientId: CLIENT,
  status: 'active',
  code: 'AAA111',
};
const KEY = { therapistId: T1, clientId: CLIENT };

const ATTACHMENT = {
  needId: 'attachment',
  ratings: { child: 2, teen: 4, now: 7 },
  notes: { child: 'мама часто уезжала', now: 'есть близкая подруга' },
};
const PLAY = { needId: 'play', ratings: { now: 0 }, notes: {} };
const WHEEL = [ATTACHMENT, PLAY];

function setup() {
  const concept: { row: any } = { row: null };
  const prisma: any = {
    ...makeRelationPrismaMock([{ ...rel }]),
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
  const relations = new TherapyRelationsService(prisma, {} as any);
  const notes = new TherapyNotesService(prisma, relations);
  const deps = { prisma, relations };
  const saveNeeds = (links: unknown, therapistId = T1) =>
    saveConceptNeeds(deps, { ...KEY, therapistId }, links);
  const upsert = prisma.clientConceptualization.upsert as jest.Mock;
  return { prisma, concept, notes, deps, saveNeeds, upsert };
}

// Концептуализация «от вкладки» с колесом «от холста».
async function seeded() {
  const s = setup();
  await s.notes.saveConceptualization(T1, CLIENT, {
    schemaIds: ['defectiveness'],
    goals: 'снизить избегание',
  });
  await s.saveNeeds(WHEEL);
  s.upsert.mockClear();
  return s;
}

describe('saveConceptNeeds — колесо потребностей', () => {
  it('сохранил колесо → getConceptualization его нашёл; ответ записи тот же', async () => {
    const { notes, saveNeeds } = setup();
    const res = await saveNeeds(WHEEL);
    const got = await notes.getConceptualization(T1, CLIENT);
    expect(got!.needLinks).toEqual(WHEEL);
    expect(res.needLinks).toEqual(WHEEL);
  });

  it('в «БД» шифротекст: ни заметки, ни потребности в открытом виде', async () => {
    const { concept, saveNeeds } = setup();
    await saveNeeds(WHEEL);
    expect(typeof concept.row.needLinks).toBe('string');
    for (const plain of ['мама часто уезжала', 'attachment', 'needId'])
      expect(concept.row.needLinks).not.toContain(plain);
  });

  it('replace: запись с меньшим набором убирает прежние оценки и заметки', async () => {
    const { notes, saveNeeds } = await seeded();
    const next = [{ needId: 'attachment', ratings: { now: 8 }, notes: {} }];
    await saveNeeds(next);
    const got = await notes.getConceptualization(T1, CLIENT);
    // Ни прежних периодов и заметок «привязанности», ни «игры».
    expect(got!.needLinks).toEqual(next);
    await saveNeeds([]);
    expect((await notes.getConceptualization(T1, CLIENT))!.needLinks).toEqual(
      [],
    );
  });

  it('строки ещё нет — создаётся пустая с колесом', async () => {
    const { upsert, saveNeeds } = setup();
    const res = await saveNeeds([PLAY]);
    expect(upsert.mock.calls[0][0].where).toEqual({
      therapistId_clientId: KEY,
    });
    expect(Object.keys(upsert.mock.calls[0][0].create).sort()).toEqual([
      'clientId',
      'needLinks',
      'therapistId',
    ]);
    expect(res).toMatchObject({ schemaIds: [], modeLinks: [], goals: null });
    expect(res.history).toEqual([]);
  });

  it('пишет только колесо: поля на месте, снимок в историю не кладётся', async () => {
    const { notes, saveNeeds, upsert } = await seeded();
    await saveNeeds([PLAY]);
    expect(Object.keys(upsert.mock.calls[0][0].update)).toEqual(['needLinks']);
    const got = await notes.getConceptualization(T1, CLIENT);
    expect(got).toMatchObject({
      schemaIds: ['defectiveness'],
      goals: 'снизить избегание',
      history: [],
    });
  });

  it('дубль потребности — остаётся первая запись, порядок — как в NEED_IDS', async () => {
    const { saveNeeds } = setup();
    const res = await saveNeeds([
      PLAY,
      ATTACHMENT,
      { needId: 'play', ratings: { now: 9 }, notes: { now: 'вторая запись' } },
    ]);
    expect(res.needLinks).toEqual([ATTACHMENT, PLAY]);
  });

  it("чужой терапевт — 'No active relation', колесо не записано и не отдано", async () => {
    const { concept, saveNeeds, upsert } = await seeded();
    const before = concept.row.needLinks;
    await expect(saveNeeds([PLAY], T2)).rejects.toThrow('No active relation');
    expect(upsert).not.toHaveBeenCalled();
    expect(concept.row.needLinks).toBe(before);
  });
});

describe('колесо и остальные пути записи концептуализации', () => {
  it('полное сохранение без needLinks оставляет колесо как было', async () => {
    const { concept, notes, upsert } = await seeded();
    const before = concept.row.needLinks;
    const res = await notes.saveConceptualization(T1, CLIENT, {
      schemaIds: ['abandonment'],
      goals: 'новые цели',
      modeLinks: [],
      schemaLinks: [],
    });
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('needLinks');
    expect(concept.row.needLinks).toBe(before);
    expect(res.needLinks).toEqual(WHEEL);
    expect(res.goals).toBe('новые цели');
  });

  // DTO поле режет (concept-needs.dto.spec.ts); если оно всё же дойдёт до
  // сервиса (старый бандл, прямой вызов) — путь записи его не знает.
  it('полное сохранение с needLinks в теле колесо не трогает', async () => {
    const { concept, notes, upsert } = await seeded();
    const before = concept.row.needLinks;
    const body = { goals: 'цели', needLinks: [] as unknown[] };
    const res = await notes.saveConceptualization(T1, CLIENT, body);
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('needLinks');
    expect(concept.row.needLinks).toBe(before);
    expect(res.needLinks).toEqual(WHEEL);
  });

  it('снимок истории колесо не несёт; восстановление версии его не трогает', async () => {
    const { concept, notes } = await seeded();
    // Вторая правка вкладки кладёт снимок прежнего состояния.
    const edited = await notes.saveConceptualization(T1, CLIENT, {
      goals: 'переписанные цели',
    });
    expect(edited.history).toHaveLength(1);
    expect(edited.history[0]).not.toHaveProperty('needLinks');
    expect(concept.row.history[0]).not.toHaveProperty('needLinks');
    // «Восстановить» шлёт поля снимка полным сохранением
    // (shared/src/therapy/conceptSnapshotRestore.ts).
    const snap = edited.history[0] as Record<string, unknown>;
    const restored = await notes.saveConceptualization(T1, CLIENT, {
      schemaIds: snap.schemaIds as string[],
      goals: snap.goals as string,
      modeLinks: snap.modeLinks as unknown[],
      schemaLinks: snap.schemaLinks as unknown[],
    });
    expect(restored.goals).toBe('снизить избегание');
    expect(restored.needLinks).toEqual(WHEEL);
  });

  it('дописывание с холста колесо не трогает и отдаёт его в ответе', async () => {
    const { deps, concept } = await seeded();
    const before = concept.row.needLinks;
    const res = await appendToConcept(deps, KEY, {
      modeIds: ['vulnerable_child'],
    });
    expect(concept.row.needLinks).toBe(before);
    expect(res!.needLinks).toEqual(WHEEL);
    expect(res!.history[0]).not.toHaveProperty('needLinks');
  });
});
