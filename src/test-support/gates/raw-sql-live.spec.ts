// Тест гейта check-raw-sql-live.mjs — «сырой SQL исполняется на живом
// Postgres» (правило №18 CLAUDE.md, инцидент 2026-09-13: $queryRaw с
// pg_advisory_xact_lock падал на драйвере при 12 зелёных юнитах с моком).
// Оба исхода плюс контрольные образцы (правило №15).
import { runGate } from './gate-sandbox';

const CI = [
  'jobs:',
  '  backend:',
  '    steps:',
  '      - run: npx jest',
  '  migrations:',
  '    steps:',
  '      - run: npx jest --config ./test/jest-e2e.json --runInBand test/live.e2e-spec.ts',
  '  webapp:',
  '    steps:',
  '      - run: npx jest --config ./test/jest-e2e.json --runInBand test/fake.e2e-spec.ts',
  '',
].join('\n');
const SERVICE =
  'export class FooMetricsService {\n  async get() {\n    return this.prisma.$queryRaw`SELECT count(*)::bigint AS c FROM "User"`;\n  }\n}\n';
const LIVE_SPEC =
  "import { FooMetricsService } from '../src/bot/foo-metrics.service';\nit('x', async () => {});\n";
const CLEAN = {
  '.github/workflows/ci.yml': CI,
  'src/bot/foo-metrics.service.ts': SERVICE,
  'test/live.e2e-spec.ts': LIVE_SPEC,
  'scripts/raw-sql-live-baseline.json': JSON.stringify({
    'src/bot/foo-metrics.service.ts': { spec: 'test/live.e2e-spec.ts' },
  }),
};

describe('check-raw-sql-live.mjs', () => {
  it('чистое дерево: файл с $queryRaw заведён на спек, который его импортирует и стоит в migrations — exit 0', () => {
    const res = runGate('check-raw-sql-live.mjs', CLEAN);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 файлов с сырым SQL, 1 исполняются');
  });

  it('новый файл с $executeRaw без записи — exit 1 (сегодняшний класс: мок молчит, драйвер падает)', () => {
    const res = runGate('check-raw-sql-live.mjs', {
      ...CLEAN,
      'src/booking/lock.ts':
        'export async function lock(tx) {\n  await tx.$executeRaw`SELECT pg_advisory_xact_lock(1)`;\n}\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/booking/lock.ts: сырой SQL без записи');
  });

  it('упоминание $queryRaw только в комментарии — не считается', () => {
    const res = runGate('check-raw-sql-live.mjs', {
      ...CLEAN,
      'src/notes.ts':
        '// $queryRaw собирается из константы, а не хардкодится дважды\nexport const x = 1;\n',
    });
    expect(res.status).toBe(0);
  });

  it('запись есть, но спек файл НЕ импортирует — exit 1 (исполняться нечему)', () => {
    const res = runGate('check-raw-sql-live.mjs', {
      ...CLEAN,
      'test/live.e2e-spec.ts': "it('пусто', async () => {});\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не импортирует этот файл');
  });

  it('спек импортирует файл, но не стоит в джобе migrations — exit 1 (там нет Postgres)', () => {
    const res = runGate('check-raw-sql-live.mjs', {
      ...CLEAN,
      'test/fake.e2e-spec.ts': LIVE_SPEC,
      'scripts/raw-sql-live-baseline.json': JSON.stringify({
        'src/bot/foo-metrics.service.ts': { spec: 'test/fake.e2e-spec.ts' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не перечислен в джобе migrations');
  });

  it('протухшая запись: сырой SQL из файла ушёл — exit 1 (сверься, что произошло)', () => {
    const res = runGate('check-raw-sql-live.mjs', {
      ...CLEAN,
      'src/bot/foo-metrics.service.ts':
        'export class FooMetricsService {\n  async get() {\n    return this.prisma.user.count();\n  }\n}\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшая запись');
  });

  it('цепочка via: спек импортирует сервис, сервис импортирует хелпер — exit 0', () => {
    const res = runGate('check-raw-sql-live.mjs', {
      ...CLEAN,
      'src/auth/merge-helper.ts':
        'export async function helper(tx) {\n  return tx.$executeRaw`DELETE FROM "User" WHERE id = 1`;\n}\n',
      'src/auth/merge.service.ts':
        "import { helper } from './merge-helper';\nexport class MergeService {\n  run(tx) {\n    return helper(tx);\n  }\n}\n",
      'test/live.e2e-spec.ts':
        LIVE_SPEC +
        "import { MergeService } from '../src/auth/merge.service';\n",
      'scripts/raw-sql-live-baseline.json': JSON.stringify({
        'src/auth/merge-helper.ts': {
          spec: 'test/live.e2e-spec.ts',
          via: 'src/auth/merge.service.ts',
        },
        'src/bot/foo-metrics.service.ts': { spec: 'test/live.e2e-spec.ts' },
      }),
    });
    expect(res.status).toBe(0);
  });

  it('КОНТРОЛЬ: via-файл сам не импортирует хелпер — цепочка не сходится, exit 1', () => {
    const res = runGate('check-raw-sql-live.mjs', {
      ...CLEAN,
      'src/auth/merge-helper.ts':
        'export async function helper(tx) {\n  return tx.$executeRaw`DELETE FROM "User" WHERE id = 1`;\n}\n',
      'src/auth/merge.service.ts': 'export class MergeService {}\n',
      'test/live.e2e-spec.ts':
        LIVE_SPEC +
        "import { MergeService } from '../src/auth/merge.service';\n",
      'scripts/raw-sql-live-baseline.json': JSON.stringify({
        'src/auth/merge-helper.ts': {
          spec: 'test/live.e2e-spec.ts',
          via: 'src/auth/merge.service.ts',
        },
        'src/bot/foo-metrics.service.ts': { spec: 'test/live.e2e-spec.ts' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не сходится по импортам');
  });

  it('exempt с честной причиной и since — exit 0; короткая причина или отписка — exit 1', () => {
    const base = {
      ...CLEAN,
      'test/live.e2e-spec.ts': "it('пусто', async () => {});\n",
    };
    const ok = runGate('check-raw-sql-live.mjs', {
      ...base,
      'scripts/raw-sql-live-baseline.json': JSON.stringify({
        'src/bot/foo-metrics.service.ts': {
          exempt:
            'долг: запрос требует расширения pg_trgm, которого нет в CI-образе',
          since: '#491',
        },
      }),
    });
    expect(ok.status).toBe(0);
    const short = runGate('check-raw-sql-live.mjs', {
      ...base,
      'scripts/raw-sql-live-baseline.json': JSON.stringify({
        'src/bot/foo-metrics.service.ts': { exempt: 'не нужно', since: '#491' },
      }),
    });
    expect(short.status).toBe(1);
    const flagged = runGate('check-raw-sql-live.mjs', {
      ...base,
      'scripts/raw-sql-live-baseline.json': JSON.stringify({
        'src/bot/foo-metrics.service.ts': {
          exempt: 'legacy-запрос, разберём когда-нибудь',
          since: '#491',
        },
      }),
    });
    expect(flagged.status).toBe(1);
    expect(flagged.stderr).toContain('отписку');
  });

  it('ключи бейслайна не отсортированы — exit 1 (правило №13)', () => {
    const res = runGate('check-raw-sql-live.mjs', {
      ...CLEAN,
      'src/api/health.ts': 'export const q = (p) => p.$queryRaw`SELECT 1`;\n',
      'test/live.e2e-spec.ts':
        LIVE_SPEC + "import { q } from '../src/api/health';\n",
      'scripts/raw-sql-live-baseline.json': JSON.stringify({
        'src/bot/foo-metrics.service.ts': { spec: 'test/live.e2e-spec.ts' },
        'src/api/health.ts': { spec: 'test/live.e2e-spec.ts' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('не отсортированы');
  });
});
