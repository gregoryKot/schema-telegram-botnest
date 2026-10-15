// Шов «ops.sh write-env ↔ супервизор контейнера» (правило №4, №14). Списки имён,
// которые write-env не пропускает из PROD_ENV, живут в deploy/vps/ops.sh одним
// источником; этот спек сверяет их с тем, что реально читают процессы контейнера
// и с docker-compose.yml. Инцидент-класс (аудит 2026-10, infra#20): строка
// NODE_ENV/APP_CMD/MIGRATE_CMD/PORT в PROD_ENV доходила до контейнера, а
// env_file сильнее ENV образа.
import { readFileSync } from 'fs';
import { join } from 'path';
import { ENV_REGISTRY } from './env-registry.entries';

const ROOT = process.cwd();
const file = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

function shellArray(src: string, name: string): string[] {
  const m = new RegExp(`^${name}=\\((.*)\\)$`, 'm').exec(src);
  if (!m) throw new Error(`в ops.sh нет однострочного массива ${name}`);
  return m[1].trim().split(/\s+/).filter(Boolean);
}

const OPS = file('deploy', 'vps', 'ops.sh');
const SUPERVISOR = shellArray(OPS, 'SUPERVISOR_ENV_NAMES');
const COMPOSE_OWNED = shellArray(OPS, 'COMPOSE_OWNED_ENV');
const TRANSFER = shellArray(OPS, 'TRANSFER_ENV_NAMES');

/** Файлы, исполняемые супервизором контейнера (entrypoint.mjs и его локальные модули). */
const SUPERVISOR_FILES = [
  'entrypoint.mjs',
  'front-server.mjs',
  'wait-for-db.mjs',
];

function envReads(src: string): string[] {
  const names = new Set<string>();
  for (const m of src.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    names.add(m[1]);
  }
  return [...names];
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
      expect(reads.length).toBeGreaterThan(0);
      const covered = new Set([...SUPERVISOR, ...COMPOSE_OWNED]);
      expect(reads.filter((r) => !covered.has(r))).toEqual([]);
    },
  );

  it('контроль сверки: имя вне списков действительно было бы замечено', () => {
    const covered = new Set([...SUPERVISOR, ...COMPOSE_OWNED]);
    const fake = envReads('const x = process.env.SOME_NEW_KNOB ?? 1;');
    expect(fake.filter((r) => !covered.has(r))).toEqual(['SOME_NEW_KNOB']);
  });

  it('deny-list не отрезает переменные приложения из реестра (кроме PORT, который супервизор выставляет приложению сам)', () => {
    // entrypoint.mjs отдаёт приложению PORT=APP_PORT, поэтому из PROD_ENV
    // приложению PORT не нужен. Любое другое пересечение — законная
    // переменная приложения, которую фильтр молча убрал бы.
    const registry = new Set(ENV_REGISTRY.map((e) => e.name));
    const denied = [...SUPERVISOR, ...COMPOSE_OWNED, ...TRANSFER];
    const clash = denied.filter((n) => registry.has(n));
    // DATABASE_URL/NODE_ENV: приложение их читает, но значение задаёт compose.
    const ALLOWED = new Set(['DATABASE_URL', 'NODE_ENV', 'PORT']);
    expect(clash.filter((n) => !ALLOWED.has(n))).toEqual([]);
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
