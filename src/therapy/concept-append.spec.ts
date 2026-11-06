// «Дописать в концептуализацию с холста» (#963) на фейковой Prisma под
// настоящим ключом шифрования: ничего не удаляет, пустое тело не пишет и не
// кладёт снимок истории, в «БД» шифротекст, а дописанное находит
// getConceptualization (read-after-write — вкладка «Концептуализация» видит
// то, что поставили на холст). Чистое объединение — concept-append.merge.spec.ts.
import { TherapyRelationsService } from './therapy-relations.service';
import { Rel, makeRelationPrismaMock } from './therapy.test-helpers';
import { loadWithKeys } from '../test-support/load-with-keys';

// Crypto-модуль разбирает ENCRYPTION_KEY при импорте: без ключа encrypt() —
// identity, и «в БД не открытый текст» ничего бы не доказывал. Оба модуля
// грузятся одной свежей копией под ключом.
const { appendToConcept, TherapyNotesService } = loadWithKeys(
  { key: 'cd'.repeat(32) },
  () => ({
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
const LINK = {
  modeId: 'punitive_critic',
  alias: 'Судья Анна',
  schemaIds: ['defectiveness'],
  needIds: ['safety'],
  origin: 'Голос отца',
  manifest: 'Не отправляет резюме',
  strategy: 'Ограничить время Критика',
};

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
  const append = (body: object, tid = T1) =>
    appendToConcept({ prisma, relations }, { ...KEY, therapistId: tid }, body);
  return { prisma, concept, notes, append };
}

// Заполненная полями концептуализация «от вкладки», затем дописывание с холста.
async function seeded() {
  const s = setup();
  await s.notes.saveConceptualization(T1, CLIENT, {
    modeIds: ['punitive_critic'],
    schemaIds: ['defectiveness'],
    goals: 'снизить избегание',
    modeLinks: [LINK],
  });
  s.prisma.clientConceptualization.upsert.mockClear();
  return s;
}

describe('appendToConcept', () => {
  it('дописал режим, схему и линию → getConceptualization их нашёл', async () => {
    const { notes, append } = await seeded();
    await append({
      modeIds: ['vulnerable_child'],
      schemaIds: ['abandonment'],
      modeLinks: [{ modeId: 'punitive_critic', schemaIds: ['shame'] }],
    });
    const got = await notes.getConceptualization(T1, CLIENT);
    expect(got!.modeIds).toEqual(['punitive_critic', 'vulnerable_child']);
    expect(got!.schemaIds).toEqual(['defectiveness', 'abandonment', 'shame']);
    // Связь сохранила alias, потребности и тексты, схемы дописаны.
    expect(got!.modeLinks).toEqual([
      { ...LINK, schemaIds: ['defectiveness', 'shame'] },
    ]);
    // Поле, которого в теле не было, не тронуто.
    expect(got!.goals).toBe('снизить избегание');
  });

  it('в «БД» шифротекст: id режимов и схем в открытом виде не лежат', async () => {
    const { concept, append } = await seeded();
    await append({ modeIds: ['vulnerable_child'], schemaIds: ['abandonment'] });
    expect(typeof concept.row.modeIds).toBe('string');
    expect(concept.row.modeIds).not.toContain('vulnerable_child');
    expect(concept.row.schemaIds).not.toContain('abandonment');
  });

  it('запись кладёт снимок прежнего состояния в историю (#752)', async () => {
    const { append } = await seeded();
    const res = await append({ modeIds: ['healthy_adult'] });
    expect(res!.history).toHaveLength(1);
    expect(res!.history[0].modeIds).toEqual(['punitive_critic']);
    expect(res!.modeIds).toEqual(['punitive_critic', 'healthy_adult']);
  });

  it('пустое тело и «всё уже есть» — ни записи, ни снимка истории, ответ — текущее', async () => {
    const { prisma, append } = await seeded();
    const a = await append({});
    const b = await append({
      modeIds: ['punitive_critic'],
      modeLinks: [{ modeId: 'punitive_critic', schemaIds: ['defectiveness'] }],
    });
    expect(prisma.clientConceptualization.upsert).not.toHaveBeenCalled();
    expect(a!.modeIds).toEqual(['punitive_critic']);
    expect(b!.history).toEqual([]);
  });

  it('строки ещё нет — создаётся со связью в форме normalizeModeLinks', async () => {
    const { notes, append } = setup();
    await append({
      modeLinks: [{ modeId: 'angry_child', schemaIds: ['mistrust'] }],
    });
    const got = await notes.getConceptualization(T1, CLIENT);
    expect(got!.modeIds).toEqual(['angry_child']);
    expect(got!.schemaIds).toEqual(['mistrust']);
    expect(got!.modeLinks).toEqual([
      {
        modeId: 'angry_child',
        alias: '',
        schemaIds: ['mistrust'],
        needIds: [],
        origin: '',
        manifest: '',
        strategy: '',
      },
    ]);
    expect(got!.history).toEqual([]);
  });

  it('строки нет и писать нечего — null, строка не создаётся', async () => {
    const { prisma, append } = setup();
    await expect(append({})).resolves.toBeNull();
    expect(prisma.clientConceptualization.upsert).not.toHaveBeenCalled();
  });

  it('чужой терапевт — отказ «No active relation», в «БД» ничего', async () => {
    const { prisma, append } = setup();
    await expect(append({ modeIds: ['x'] }, T2)).rejects.toThrow(
      'No active relation',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
