// Шов «миграция пишет — проба читает» (правило №14): обе стороны по отдельности
// покрыты спеками, а здесь настоящая migrateClinicalLabels идёт через
// настоящую обёртку в настоящую пробу. Модули грузятся в одном
// jest.isolateModules: crypto читает ключи при загрузке, а холдер состояния —
// синглтон, и миграция с пробой обязаны видеть один и тот же экземпляр.
import { readFileSync } from 'fs';
import { join } from 'path';
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

describe('зависшая миграция → красная проба (шов на настоящих модулях)', () => {
  it('findMany не возвращается: в пределах порога зелёная, за порогом красная', async () => {
    quiet();
    const { status, probe } = load(KEY_A);
    const db = dbWith([]);
    (db.note.findMany as jest.Mock).mockReturnValue(new Promise(() => {}));
    void status.runClinicalLabelMigration(db, { error: jest.fn() });

    const since = status.clinicalLabelsStatus.get().since;
    const at = (ms: number) => () => since + ms;
    const p = (ms: number) =>
      probe.clinicalLabelsProbe({ ENCRYPTION_KEY: KEY_A }, at(ms)).run();

    expect(status.clinicalLabelsStatus.get().state).toBe('running');
    expect((await p(probe.CLINICAL_LABELS_STUCK_MS - 1)).ok).toBe(true);
    const stuck = await p(probe.CLINICAL_LABELS_STUCK_MS);
    expect(stuck.ok).toBe(false);
    expect(stuck.detail).toContain('идёт уже 15 мин');
  });
});

describe('since: момент последней смены состояния (по нему проба ловит зависание)', () => {
  const EMPTY = { encrypted: {}, failures: 0, unknownKey: {} };

  it('reset(now) → idle с since = now', () => {
    const { status } = load(KEY_A);
    status.clinicalLabelsStatus.reset(1000);
    expect(status.clinicalLabelsStatus.get()).toMatchObject({
      state: 'idle',
      since: 1000,
    });
  });

  it('start → running, finish → done, fail → failed: since берётся из момента смены', () => {
    const { status } = load(KEY_A);
    const h = status.clinicalLabelsStatus;
    h.start(2000);
    expect(h.get()).toMatchObject({ state: 'running', since: 2000 });
    h.finish(EMPTY, 3000);
    expect(h.get()).toMatchObject({ state: 'done', since: 3000 });
    h.fail('boom', 4000);
    expect(h.get()).toMatchObject({ state: 'failed', since: 4000 });
  });
});

// Шов «main.ts → холдер» (правило №14): без вызова runClinicalLabelMigration
// холдер вечно idle, а проба без таймера вечно рапортовала бы «ещё идёт».
// Таймер в пробе поймает пропажу вызова на проде; этот пин ловит её в CI.
describe('main.ts запускает миграцию клинических меток', () => {
  const code = readFileSync(join(__dirname, '..', '..', 'main.ts'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  it('runClinicalLabelMigration импортирован из холдера пробы', () => {
    expect(code).toMatch(
      /import \{[^}]*\brunClinicalLabelMigration\b[^}]*\} from '\.\/infra\/self-check\/clinical-labels-status'/,
    );
  });

  it('и вызывается с PrismaService из приложения', () => {
    expect(code).toMatch(
      /\brunClinicalLabelMigration\(\s*app\.get\(PrismaService\)/,
    );
  });
});
