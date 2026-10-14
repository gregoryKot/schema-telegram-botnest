// Автооткат deploy/vps/ops.sh поверх упавшей миграции (аудит 2026-10-11,
// infra#8). Раньше откат возвращал образ, но не схему: упавшая миграция
// нового релиза оставляла в _prisma_migrations запись с finished_at IS NULL,
// prev-образ упирался в неё (P3009) и не поднимался, а release.prev к этому
// моменту уже был стёрт, так что и ручной rollback был невозможен.
//
// Что здесь проверяется: решения САМОГО скрипта (порядок stop -> снять запись
// -> поднять prev, когда стирать release.prev, что попадает в публичный лог).
// Базу изображает поддельный docker: «упавшая миграция» — файл stuck, «P3009» —
// prev не здоров, пока файл есть. Что настоящий Postgres и Prisma ведут себя
// именно так (запись остаётся, DELETE её снимает, migrate deploy проходит),
// доказывает test/migrate-stuck-record.e2e-spec.ts на живой базе.
import { spawnSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

jest.setTimeout(120_000);

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const IMAGE = 'ghcr.io/owner/repo';
const BROKEN_MIGRATION = '20261011120000_broken_dup_user';

// Поддельный docker. Запуск релиза FAKE_BAD (его миграция падает) оставляет
// запись $FAKE_STATE/stuck. Здоров только релиз из FAKE_HEALTHY и только пока
// записи нет (она и есть P3009). DELETE снимает запись и печатает её имя.
const FAKE_DOCKER = `#!/bin/bash
echo "docker $*" >> "$FAKE_LOG"
case "$*" in
  # Токен идёт в stdin: если docker выйдет, не прочитав его, printf получит
  # SIGPIPE и «вход в ghcr не удался» (pipefail) — мигающий красный на нагрузке.
  "login "*) cat > /dev/null ;;
  *" up -d "*app*)
    if [ "$(cat release 2>/dev/null)" = "$FAKE_BAD" ]; then
      printf '%s' "\${FAKE_STUCK_NAME:-${BROKEN_MIGRATION}}" > "$FAKE_STATE/stuck"
    fi ;;
  *" exec -T app node"*)
    if [ ! -e "$FAKE_STATE/stuck" ] && [[ " $FAKE_HEALTHY " == *" $(cat release 2>/dev/null) "* ]]; then
      echo '{"status":"ok","db":"up"}'
    fi ;;
  *" exec -T db psql"*"DELETE FROM"*)
    [ "\${FAKE_PSQL_EXIT:-0}" = "0" ] || exit "$FAKE_PSQL_EXIT"
    if [ -e "$FAKE_STATE/stuck" ]; then cat "$FAKE_STATE/stuck"; echo; rm -f "$FAKE_STATE/stuck"; fi ;;
  "images "*) ;;
esac
exit 0
`;

describe('deploy/vps/ops.sh: откат поверх упавшей миграции', () => {
  let dir: string;
  let log: string;
  const base = () => join(dir, 'srv');
  const state = () => join(dir, 'state');
  const read = (f: string) => readFileSync(join(base(), f), 'utf8');
  const stuckLeft = () => existsSync(join(state(), 'stuck'));
  const dockerLines = () =>
    existsSync(log) ? readFileSync(log, 'utf8').split('\n') : [];
  const lineOf = (re: RegExp) => dockerLines().findIndex((l) => re.test(l));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vps-rollback-'));
    log = join(dir, 'docker.log');
    mkdirSync(join(dir, 'bin'));
    mkdirSync(base());
    mkdirSync(state());
    writeFileSync(join(dir, 'bin', 'docker'), FAKE_DOCKER, { mode: 0o755 });
    for (const f of ['ops.sh', 'dc.sh']) {
      copyFileSync(join(process.cwd(), 'deploy', 'vps', f), join(base(), f));
    }
    writeFileSync(join(base(), 'db.env'), 'POSTGRES_PASSWORD=pw\n');
    writeFileSync(join(base(), '.env'), 'X=1\n');
    writeFileSync(join(base(), 'docker-compose.yml'), 'services: {}\n');
    writeFileSync(join(base(), 'image'), IMAGE);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function ops(args: string[], env: Record<string, string> = {}, input = '') {
    return spawnSync('bash', [join(base(), 'ops.sh'), ...args], {
      env: {
        ...process.env,
        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
        SCHEMEHAPPENS_DIR: base(),
        FAKE_LOG: log,
        FAKE_STATE: state(),
        FAKE_BAD: NEW,
        FAKE_HEALTHY: OLD,
        OPS_HEALTH_LIMIT: '2',
        OPS_HEALTH_POLL: '1',
        ...env,
      },
      input,
      encoding: 'utf8',
      timeout: 90_000,
    });
  }
  const deploy = (env: Record<string, string> = {}) =>
    ops(['deploy', IMAGE, NEW, 'octocat'], env, 'ghp_token\n');
  const seed = (cur: string, prev?: string) => {
    writeFileSync(join(base(), 'release'), cur);
    if (prev) writeFileSync(join(base(), 'release.prev'), prev);
  };

  describe('деплой с упавшей миграцией → автооткат', () => {
    it('застрявшая запись снимается ДО подъёма prev, prev здоров, release.prev стёрт, в логе только имя', () => {
      seed(OLD);

      const res = deploy();

      expect(res.status).toBe(1); // джоба красная: релиз не прижился
      expect(res.stderr).toContain('деплой не удался');
      expect(res.stdout).toContain(
        `снята застрявшая запись миграции: ${BROKEN_MIGRATION}`,
      );
      expect(res.stdout).toMatch(/ОТКАТ: b{12} -> a{12}/);
      expect(res.stdout).toContain('приложение здорово');
      expect(read('release')).toBe(OLD);
      expect(existsSync(join(base(), 'release.prev'))).toBe(false);
      expect(stuckLeft()).toBe(false);

      // Порядок и есть починка: остановить, снять запись, только потом prev.
      const stop = lineOf(/ stop app$/);
      const del = lineOf(/DELETE FROM/);
      const upPrev = dockerLines().findIndex(
        (l, i) => i > del && / up -d app$/.test(l),
      );
      expect(stop).toBeGreaterThan(-1);
      expect(del).toBeGreaterThan(stop);
      expect(upPrev).toBeGreaterThan(del);
    });

    it('контроль: если запись снять не удалось, prev не здоров (модель P3009 не вечнозелёная)', () => {
      seed(NEW, OLD);
      writeFileSync(join(state(), 'stuck'), BROKEN_MIGRATION);

      const res = ops(['rollback'], { FAKE_PSQL_EXIT: '1' });

      expect(res.status).toBe(1);
      expect(res.stdout).toContain(
        'не удалось обратиться к _prisma_migrations',
      );
      expect(res.stdout).toContain('откат не стал здоровым');
      expect(stuckLeft()).toBe(true);
      expect(read('release.prev')).toBe(OLD);
    });

    it('prev не поднялся здоровым → release.prev остаётся, повторный rollback после починки проходит', () => {
      seed(OLD);

      // Откат тоже нездоров (база не починена): здоровых релизов нет.
      const first = deploy({ FAKE_HEALTHY: '' });

      expect(first.status).toBe(1);
      expect(first.stdout).toContain('откат не стал здоровым');
      expect(read('release')).toBe(OLD);
      expect(read('release.prev')).toBe(OLD); // не стёрт: rollback ещё имеет смысл

      const second = ops(['rollback'], { FAKE_HEALTHY: OLD });

      expect(second.status).toBe(0);
      expect(second.stdout).toContain('приложение здорово');
      expect(read('release')).toBe(OLD);
      expect(existsSync(join(base(), 'release.prev'))).toBe(false);
      expect(ops(['rollback'], { FAKE_HEALTHY: OLD }).stdout).toContain(
        'откатываться некуда',
      );
    });

    it('образ prev не скачан/не стартует (up -d упал) → release.prev тоже остаётся', () => {
      seed(NEW, OLD);
      const failing = join(dir, 'bin', 'docker');
      writeFileSync(
        failing,
        FAKE_DOCKER.replace(
          '*" up -d "*app*)',
          '*" up -d app"*) exit 1 ;;\n  *" up -d "*app*)',
        ),
        { mode: 0o755 },
      );

      const res = ops(['rollback']);

      expect(res.status).toBe(1);
      expect(res.stdout).toContain('release.prev оставлен');
      expect(read('release.prev')).toBe(OLD);
    });

    it('в публичный лог не попадает ничего, кроме имени миграции стандартного вида', () => {
      seed(OLD);

      const res = deploy({
        FAKE_STUCK_NAME: 'x; password=hunter2 имя с пробелами',
      });

      expect(res.stdout + res.stderr).not.toMatch(/hunter2|пробелами/);
      expect(res.stdout).toContain('снято записей с нестандартным именем: 1');
    });

    it('сбой psql при откате не мешает откату: prev поднимается', () => {
      seed(NEW, OLD);

      const res = ops(['rollback'], { FAKE_PSQL_EXIT: '2' });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain(
        'не удалось обратиться к _prisma_migrations',
      );
      expect(read('release')).toBe(OLD);
    });
  });

  describe('op=migrate-resolve-failed', () => {
    it('снимает запись и печатает только имя; приложение и release не трогает', () => {
      seed(NEW, OLD);
      writeFileSync(join(state(), 'stuck'), BROKEN_MIGRATION);

      const res = ops(['migrate-resolve-failed']);

      expect(res.status).toBe(0);
      expect(res.stdout).toContain(
        `снята застрявшая запись миграции: ${BROKEN_MIGRATION}`,
      );
      expect(res.stdout).toContain('op=rollback');
      expect(stuckLeft()).toBe(false);
      expect(read('release')).toBe(NEW);
      expect(read('release.prev')).toBe(OLD);
      const calls = dockerLines().join('\n');
      expect(calls).not.toMatch(/stop app|up -d app|restart/);
      expect(calls).toMatch(/up -d db$/m);
    });

    it('чистая база: «застрявших записей нет», код 0', () => {
      const res = ops(['migrate-resolve-failed']);

      expect(res.status).toBe(0);
      expect(res.stdout).toContain('застрявших записей миграций нет');
    });

    it('база не отвечает → код 1, а не молчаливый успех', () => {
      const res = ops(['migrate-resolve-failed'], { FAKE_PSQL_EXIT: '1' });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('запись не снята');
    });

    it('без bootstrap (нет db.env) отказывается и docker не зовёт', () => {
      rmSync(join(base(), 'db.env'));

      const res = ops(['migrate-resolve-failed']);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('op=bootstrap');
      expect(dockerLines().join('')).toBe('');
    });
  });

  describe('один и тот же запрос в двух местах (правило №4)', () => {
    const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

    it('RESOLVE_FAILED_SQL в ops.sh совпадает с оператором из prisma/recover-p3009.sql', () => {
      const sql = readFileSync(
        join(process.cwd(), 'prisma', 'recover-p3009.sql'),
        'utf8',
      );
      const statement = squash(
        sql
          .split('\n')
          .filter((l) => !l.trim().startsWith('--'))
          .join('\n')
          .replace(/;\s*$/, ''),
      );
      const ops_sh = readFileSync(
        join(process.cwd(), 'deploy', 'vps', 'ops.sh'),
        'utf8',
      );
      const m = /^RESOLVE_FAILED_SQL='([^']+)'$/m.exec(ops_sh);

      expect(m).not.toBeNull();
      expect(squash(m![1])).toBe(statement);
    });

    it('в psql уходит именно он (никакого другого SQL у операции нет)', () => {
      ops(['migrate-resolve-failed']);

      const psql = dockerLines().filter((l) => /exec -T db psql/.test(l));
      expect(psql.some((l) => /DELETE FROM "_prisma_migrations"/.test(l))).toBe(
        true,
      );
      expect(psql.every((l) => /DELETE FROM|pg_isready/.test(l))).toBe(true);
    });
  });

  describe('проводка в .github/workflows/vps.yml', () => {
    const yml = readFileSync(
      join(process.cwd(), '.github', 'workflows', 'vps.yml'),
      'utf8',
    );

    it('операция есть и в списке запуска, и в закрытом case шага «Операция»', () => {
      expect(yml).toMatch(/options:[\s\S]*- migrate-resolve-failed\n/);
      expect(yml).toMatch(/\|rollback\|migrate-resolve-failed\)\n/);
    });

    it('ops.sh знает операцию (иначе воркфлоу вызвал бы «неизвестная операция»)', () => {
      expect(ops(['migrate-resolve-failed']).stderr).not.toContain(
        'неизвестная операция',
      );
    });
  });
});
