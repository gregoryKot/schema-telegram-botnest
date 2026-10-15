// Шов «ops.sh write-env ↔ супервизор контейнера» (правило №4, №14). Списки имён,
// которые write-env не пропускает из PROD_ENV, живут в deploy/vps/ops.sh одним
// источником; этот спек сверяет их с тем, что реально читают процессы контейнера
// и с docker-compose.yml. Инцидент-класс (аудит 2026-10, infra#20): строка
// NODE_ENV/APP_CMD/MIGRATE_CMD/PORT в PROD_ENV доходила до контейнера, а
// env_file сильнее ENV образа.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, posix } from 'path';
import { ENV_REGISTRY } from './env-registry.entries';

const ROOT = process.cwd();
const file = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

function shellArray(src: string, name: string): string[] {
  const m = new RegExp(`^${name}=\\((.*)\\)$`, 'm').exec(src);
  if (!m) throw new Error(`в ops.sh нет однострочного массива ${name}`);
  return m[1].trim().split(/\s+/).filter(Boolean);
}

const OPS = file('deploy', 'vps', 'ops.sh');
/**
 * Имена deny-list, которые есть и в реестре env, но отбрасываются законно: их
 * значение задаёт docker-compose.yml в `environment` (сильнее env_file), так что
 * строка из PROD_ENV всё равно была бы перекрыта, а на VPS ей не место.
 */
const COMPOSE_OWNED_IN_REGISTRY = new Set([
  'DATABASE_URL', // на VPS в PROD_ENV лежит прежний адрес Amvera
  'DEPLOY_TARGET', // признак площадки: «vps» задаёт compose, а не секрет
]);

function registryClashes(denied: string[], registry: Set<string>): string[] {
  return denied.filter(
    (n) => registry.has(n) && !COMPOSE_OWNED_IN_REGISTRY.has(n),
  );
}

const SUPERVISOR = shellArray(OPS, 'SUPERVISOR_ENV_NAMES');
const COMPOSE_OWNED = shellArray(OPS, 'COMPOSE_OWNED_ENV');
const TRANSFER = shellArray(OPS, 'TRANSFER_ENV_NAMES');

/**
 * Локальные `.mjs`-импорты одного файла: `from './x.mjs'`, `import './x.mjs'`,
 * `import('./x.mjs')`, в одинарных и двойных кавычках. Пакеты (`node:net`) не
 * подходят: путь обязан начинаться с `./` или `../`.
 */
const LOCAL_MJS_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.{1,2}\/[\w./-]+\.mjs)\1/g;

/**
 * Обход локальных `.mjs`-импортов от входа, рекурсивно (visited-set: циклы не
 * зависают). Имена — пути от корня обхода через `/`, вход первым.
 */
function walkLocalMjs(entry: string, read: (name: string) => string): string[] {
  const visited = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const m of read(cur).matchAll(LOCAL_MJS_IMPORT)) {
      queue.push(posix.normalize(posix.join(posix.dirname(cur), m[2])));
    }
  }
  return [...visited];
}

/**
 * Файлы, исполняемые супервизором контейнера: entrypoint.mjs и все его локальные
 * `.mjs`-модули, в том числе вложенные, выводятся из импортов, а не списком
 * (новый модуль, прочитавший env, не должен выпасть из сверки).
 * `backup-scheduler.cjs` намеренно вне сверки: он читает B2_*, PG*, HOSTNAME —
 * переменные приложения из реестра, которые обязаны приходить из PROD_ENV.
 */
function supervisorFiles(): string[] {
  return walkLocalMjs('entrypoint.mjs', (n) => file('deploy', n));
}
const SUPERVISOR_FILES = supervisorFiles();

function envReads(src: string): string[] {
  const names = new Set<string>();
  for (const m of src.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    names.add(m[1]);
  }
  return [...names];
}

/** Формы чтения env, которых envReads не видит: их в deploy/*.mjs быть не должно. */
function blindEnvForms(src: string): string[] {
  return [...src.matchAll(/process\.env\s*\[|\}\s*=\s*process\.env\b/g)].map(
    (m) => m[0],
  );
}

describe('deny-list write-env ↔ супервизор и compose', () => {
  it('списки отсортированы и без повторов (правило №13)', () => {
    for (const list of [SUPERVISOR, COMPOSE_OWNED, TRANSFER]) {
      expect(list).toEqual([...new Set(list)].sort());
    }
    const all = [...SUPERVISOR, ...COMPOSE_OWNED, ...TRANSFER];
    expect(new Set(all).size).toBe(all.length);
  });

  it.each(SUPERVISOR_FILES)(
    'каждое process.env.X из deploy/%s есть в deny-list или в списке compose',
    (name) => {
      const reads = envReads(file('deploy', name));
      const covered = new Set([...SUPERVISOR, ...COMPOSE_OWNED]);
      expect(reads.filter((r) => !covered.has(r))).toEqual([]);
    },
  );

  it('список файлов супервизора выведен из импортов и не пуст', () => {
    expect(SUPERVISOR_FILES).toEqual(
      expect.arrayContaining([
        'entrypoint.mjs',
        'front-server.mjs',
        'wait-for-db.mjs',
        'app-exit.mjs',
      ]),
    );
    // Сверка не вырождается в пустую: сегодня супервизор читает 15+ имён.
    const all = new Set(
      SUPERVISOR_FILES.flatMap((f) => envReads(file('deploy', f))),
    );
    expect(all.size).toBeGreaterThanOrEqual(15);
  });

  it.each(SUPERVISOR_FILES)(
    'в deploy/%s нет чтения env в обход process.env.X (деструктуринг, process.env[…])',
    (name) => {
      expect(blindEnvForms(file('deploy', name))).toEqual([]);
    },
  );

  it('обход импортов находит всё, что находила прежняя сверка по прямым импортам entrypoint.mjs', () => {
    const direct = [
      ...file('deploy', 'entrypoint.mjs').matchAll(
        /from '\.\/([\w.-]+\.mjs)'/g,
      ),
    ].map((m) => m[1]);
    expect(direct.length).toBeGreaterThan(0);
    expect(SUPERVISOR_FILES).toEqual(expect.arrayContaining(direct));
  });

  describe('walkLocalMjs: обход локальных импортов (контроль на фикстуре)', () => {
    let tmp: string;
    const put = (name: string, src: string) => {
      mkdirSync(join(tmp, posix.dirname(name)), { recursive: true });
      writeFileSync(join(tmp, name), src);
    };
    const walk = () =>
      walkLocalMjs('main.mjs', (n) => readFileSync(join(tmp, n), 'utf8'));

    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), 'vps-env-walk-'));
    });
    afterEach(() => {
      rmSync(tmp, { recursive: true, force: true });
    });

    it('идёт вглубь, понимает двойные кавычки, side-effect и динамический import', () => {
      put(
        'main.mjs',
        [
          "import { a } from './a.mjs';",
          'import b from "./b.mjs";',
          'import "./side.mjs";',
          "const c = await import('./dyn.mjs');",
        ].join('\n'),
      );
      put('a.mjs', 'export { z } from "./deep/z.mjs";');
      put('deep/z.mjs', "import '../tail.mjs';");
      for (const n of ['b.mjs', 'side.mjs', 'dyn.mjs', 'tail.mjs']) {
        put(n, 'export const x = 1;');
      }

      expect(walk().sort()).toEqual(
        [
          'a.mjs',
          'b.mjs',
          'deep/z.mjs',
          'dyn.mjs',
          'main.mjs',
          'side.mjs',
          'tail.mjs',
        ].sort(),
      );
    });

    it('циклы не зависают, пакеты и .cjs не попадают в обход', () => {
      put(
        'main.mjs',
        "import './a.mjs'; import 'node:net'; import x from './sched.cjs';",
      );
      put('a.mjs', "import './main.mjs'; import { y } from 'node:fs';");

      expect(walk().sort()).toEqual(['a.mjs', 'main.mjs']);
    });
  });

  it('контроль: слепые формы действительно распознаются', () => {
    expect(blindEnvForms('const { A } = process.env;')).toHaveLength(1);
    expect(blindEnvForms("process.env['A']")).toHaveLength(1);
    expect(blindEnvForms('const a = process.env.A;')).toEqual([]);
  });

  it('контроль сверки: имя вне списков действительно было бы замечено', () => {
    const covered = new Set([...SUPERVISOR, ...COMPOSE_OWNED]);
    const fake = envReads('const x = process.env.SOME_NEW_KNOB ?? 1;');
    expect(fake.filter((r) => !covered.has(r))).toEqual(['SOME_NEW_KNOB']);
  });

  it('deny-list не отрезает переменные приложения из реестра', () => {
    const registry = new Set(ENV_REGISTRY.map((e) => e.name));
    const denied = [...SUPERVISOR, ...COMPOSE_OWNED, ...TRANSFER];
    expect(registryClashes(denied, registry)).toEqual([]);
  });

  it('контроль: законная переменная приложения в deny-list была бы замечена', () => {
    const registry = new Set(ENV_REGISTRY.map((e) => e.name));
    expect(registry.has('BOT_TOKEN')).toBe(true);
    expect(registryClashes(['APP_CMD', 'BOT_TOKEN'], registry)).toEqual([
      'BOT_TOKEN',
    ]);
  });

  it('docker-compose.yml: app.environment задаёт NODE_ENV: production и DATABASE_URL', () => {
    const compose = file('deploy', 'vps', 'docker-compose.yml');
    const app = /^ {2}app:\n([\s\S]*?)(?=^ {2}\S)/m.exec(compose)?.[1] ?? '';
    const env =
      /^ {4}environment:\n((?: {6}.*\n|\s*\n)+)/m.exec(app)?.[1] ?? '';
    expect(env).toMatch(/^ {6}NODE_ENV: production$/m);
    expect(env).toMatch(/^ {6}DATABASE_URL: /m);
    for (const n of COMPOSE_OWNED) {
      expect(env).toMatch(new RegExp(`^ {6}${n}: `, 'm'));
    }
  });
});
