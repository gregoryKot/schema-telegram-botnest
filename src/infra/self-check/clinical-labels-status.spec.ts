// Шов «миграция пишет — проба читает» (правило №14): обе стороны по отдельности
// покрыты спеками, а здесь настоящая migrateClinicalLabels идёт через
// настоящую обёртку в настоящую пробу. Модули грузятся в одном
// jest.isolateModules: crypto читает ключи при загрузке, а холдер состояния —
// синглтон, и миграция с пробой обязаны видеть один и тот же экземпляр.
import type { PrismaService } from '../../prisma/prisma.service';

type Status = typeof import('./clinical-labels-status');
type Probe = typeof import('./probe-clinical-labels');
type Crypto = typeof import('../../utils/crypto');

const KEY_A = 'aa'.repeat(32);
const KEY_B = 'bb'.repeat(32);
const ORIGINAL_ENV = { ...process.env };

function load(key: string) {
  process.env.ENCRYPTION_KEY = key;
  process.env.ENCRYPTION_KEY_OLD = '';
  process.env.NODE_ENV = 'test';
  let status!: Status;
  let probe!: Probe;
  let crypto!: Crypto;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    crypto = require('../../utils/crypto') as Crypto;
    status = require('./clinical-labels-status') as Status;
    probe = require('./probe-clinical-labels') as Probe;
    /* eslint-enable @typescript-eslint/no-require-imports */
  });
  return { status, probe, crypto };
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

const dbWith = (notes: Array<{ id: number; tags: string }>) => {
  const empty = {
    findMany: jest.fn(() => Promise.resolve([])),
    update: jest.fn(),
  };
  return {
    note: {
      findMany: jest.fn(() => Promise.resolve(notes)),
      update: jest.fn(() => Promise.resolve({})),
    },
    user: empty,
    schemaDiaryEntry: empty,
    modeDiaryEntry: empty,
    clientConceptualization: empty,
  } as unknown as PrismaService;
};

const quiet = () => {
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
};

describe('runClinicalLabelMigration → clinicalLabelsProbe', () => {
  it('строка под чужим ключом: миграция записала, проба красная с именем таблицы', async () => {
    quiet();
    const oldBlob = load(KEY_A).crypto.encrypt('anxiety,anger')!;
    const { status, probe } = load(KEY_B);
    const logger = { error: jest.fn() };

    await status.runClinicalLabelMigration(
      dbWith([{ id: 1, tags: oldBlob }]),
      logger,
    );

    const res = await probe
      .clinicalLabelsProbe({ ENCRYPTION_KEY: KEY_B })
      .run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('Note: 1');
    expect(logger.error).not.toHaveBeenCalled(); // сводку шлёт сама миграция
  });

  it('плейнтекст дошифрован: проба зелёная', async () => {
    quiet();
    const { status, probe } = load(KEY_A);
    const db = dbWith([{ id: 1, tags: 'anxiety' }]);

    await status.runClinicalLabelMigration(db, { error: jest.fn() });

    expect(status.clinicalLabelsStatus.get().encrypted).toBe(1);
    const res = await probe
      .clinicalLabelsProbe({ ENCRYPTION_KEY: KEY_A })
      .run();
    expect(res).toEqual({ ok: true, detail: 'все метки зашифрованы' });
  });

  it('исключение миграции: logger.error, состояние failed, наружу не летит', async () => {
    quiet();
    const { status, probe } = load(KEY_A);
    const db = dbWith([]);
    (db.note.findMany as jest.Mock).mockRejectedValue(new Error('db down'));
    const logger = { error: jest.fn() };

    await expect(
      status.runClinicalLabelMigration(db, logger),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      'Clinical-label migration failed: db down',
    );
    expect(status.clinicalLabelsStatus.get()).toMatchObject({
      state: 'failed',
      lastError: 'db down',
    });
    const res = await probe
      .clinicalLabelsProbe({ ENCRYPTION_KEY: KEY_A })
      .run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('db down');
  });

  it('во время прогона состояние running', async () => {
    quiet();
    const { status } = load(KEY_A);
    const db = dbWith([]);
    let seen = '';
    (db.note.findMany as jest.Mock).mockImplementation(() => {
      seen = status.clinicalLabelsStatus.get().state;
      return Promise.resolve([]);
    });
    await status.runClinicalLabelMigration(db, { error: jest.fn() });
    expect(seen).toBe('running');
    expect(status.clinicalLabelsStatus.get().state).toBe('done');
  });
});
