// Логика deploy/vps/ops.sh (деплой, автооткат, HOLD_APP, запись .env) с
// поддельным docker в PATH. Что настоящий docker compose поднимет контейнеры,
// здесь не проверяется (это делает первый живой деплой и /health); проверяется
// то, что скрипт решает САМ: что записать в release/release.prev, когда
// откатываться, что не печатать (логи Actions публичны), когда не стартовать
// приложение. Откат — единственное, что вытаскивает прод после битого релиза,
// поэтому он обязан уметь работать, а не только выглядеть написанным.
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

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const IMAGE = 'ghcr.io/owner/repo';
const TOKEN = 'ghp_SECRET_TOKEN_VALUE';

// Поддельный docker: всё пишет в $FAKE_LOG; `exec` (проба здоровья) отвечает
// «ок» только если текущий release входит в $FAKE_HEALTHY; `port` — по $FAKE_PORT_OPEN.
const FAKE_DOCKER = `#!/bin/bash
echo "docker $*" >> "$FAKE_LOG"
case "$*" in
  *" exec -T app node"*)
    if [[ " $FAKE_HEALTHY " == *" $(cat release 2>/dev/null) "* ]]; then
      echo '{"status":"ok","db":"up"}'
    fi ;;
  *" port db 5432"*) [ "\${FAKE_PORT_OPEN:-0}" = "1" ] || exit 1; echo "0.0.0.0:5432" ;;
  "images "*) ;;
  # docker run вне compose — проверка внешнего подключения (external-db-check).
  "run --rm --network host"*)
    printf '%s' "$DATABASE_URL" > "$FAKE_URL_FILE"
    printf '%s' "\${FAKE_CHECK_OUT:-}"
    exit "\${FAKE_CHECK_EXIT:-0}" ;;
  *" exec -T db psql"*information_schema*) echo "\${FAKE_TABLES:-0}" ;;
  *" exec -T db psql"*"count(*) FROM _prisma_migrations"*) echo "\${FAKE_MIGS:-0}" ;;
  *" exec -T db psql"*'FROM "User"'*) echo "\${FAKE_USERS:-0}" ;;
  # compose run — контейнер восстановления. FAKE_RUN_EXEC=1: выполнить его
  # скрипт (-c) по-настоящему в $FAKE_RUN_CWD с поддельными scripts/*.sh.
  *" run --rm --no-deps"*)
    if [ -n "\${FAKE_RUN_EXEC:-}" ]; then
      script=""; prev=""
      for a in "$@"; do [ "$prev" = "-c" ] && script=$a; prev=$a; done
      cd "$FAKE_RUN_CWD" && DATABASE_URL="postgresql://postgres:RUNSECRETPW@db:5432/schemehappens" bash -c "$script"
      exit $?
    fi
    printf '%s\n' "\${FAKE_RUN_OUT:-}"
    exit "\${FAKE_RUN_EXIT:-0}" ;;
esac
exit 0
`;

describe('deploy/vps/ops.sh', () => {
  let dir: string;
  let bin: string;
  let log: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vps-ops-'));
    bin = join(dir, 'bin');
    log = join(dir, 'docker.log');
    const base = join(dir, 'srv');
    mkdirSync(bin);
    mkdirSync(base);
    writeFileSync(join(bin, 'docker'), FAKE_DOCKER, { mode: 0o755 });
    for (const f of ['ops.sh', 'dc.sh', 'external-db-check.sh']) {
      copyFileSync(join(process.cwd(), 'deploy', 'vps', f), join(base, f));
    }
    writeFileSync(join(base, 'db.env'), 'POSTGRES_PASSWORD=pw\n');
    writeFileSync(join(base, '.env'), 'X=1\n');
    writeFileSync(join(base, 'docker-compose.yml'), 'services: {}\n');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const base = () => join(dir, 'srv');
  const read = (f: string) => readFileSync(join(base(), f), 'utf8');
  const dockerLog = () => (existsSync(log) ? readFileSync(log, 'utf8') : '');

  function ops(args: string[], env: Record<string, string> = {}, input = '') {
    return spawnSync('bash', [join(base(), 'ops.sh'), ...args], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        SCHEMEHAPPENS_DIR: base(),
        FAKE_LOG: log,
        FAKE_URL_FILE: join(dir, 'db-url'),
        FAKE_HEALTHY: NEW,
        OPS_HEALTH_LIMIT: '2',
        OPS_HEALTH_POLL: '1',
        ...env,
      },
      input,
      encoding: 'utf8',
      timeout: 60_000,
    });
  }
  const deploy = (sha: string, env: Record<string, string> = {}) =>
    ops(['deploy', IMAGE, sha, 'octocat'], env, `${TOKEN}\n`);
  const seedRelease = (cur: string) => {
    writeFileSync(join(base(), 'release'), cur);
    writeFileSync(join(base(), 'image'), IMAGE);
  };

  it('деплой: релиз записан, предыдущий сохранён в release.prev, здоровье дождались', () => {
    seedRelease(OLD);

    const res = deploy(NEW);

    expect(res.status).toBe(0);
    expect(read('release')).toBe(NEW);
    expect(read('release.prev')).toBe(OLD);
    expect(read('image')).toBe(IMAGE);
    expect(res.stdout).toContain('приложение здорово');
    expect(dockerLog()).toMatch(/up -d --remove-orphans db caddy app/);
  });

  it('первый деплой: prev нет, при провале здоровья откатываться некуда → код 1', () => {
    const res = deploy(NEW, { FAKE_HEALTHY: '' });

    expect(res.status).toBe(1);
    expect(res.stdout).toContain('откатываться некуда');
    expect(existsSync(join(base(), 'release.prev'))).toBe(false);
  });

  it('релиз не поднялся → автооткат на предыдущий, release.prev стёрт, джоба красная', () => {
    seedRelease(OLD);

    const res = deploy(NEW, { FAKE_HEALTHY: OLD }); // здорова только старая версия

    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/ОТКАТ: b{12} -> a{12}/);
    expect(read('release')).toBe(OLD);
    expect(existsSync(join(base(), 'release.prev'))).toBe(false);
    expect(res.stderr).toContain('деплой не удался');
  });

  it('повторный деплой того же sha не затирает release.prev самим собой', () => {
    seedRelease(NEW);
    writeFileSync(join(base(), 'release.prev'), OLD);

    expect(deploy(NEW).status).toBe(0);
    expect(read('release.prev')).toBe(OLD);
  });

  it('HOLD_APP: поднимаются только db и caddy, приложение нет, релиз записан, код 0', () => {
    writeFileSync(join(base(), 'HOLD_APP'), '');

    const res = deploy(NEW, { FAKE_HEALTHY: '' });

    expect(res.status).toBe(0);
    expect(read('release')).toBe(NEW);
    const log = dockerLog();
    expect(log).toMatch(/up -d --remove-orphans db caddy\n/);
    expect(log).not.toMatch(/up -d .* app/);
    expect(res.stdout).toContain('HOLD_APP');
  });

  it('release-hold: снимает флаг и поднимает приложение; при провале откатывается', () => {
    seedRelease(NEW);
    writeFileSync(join(base(), 'HOLD_APP'), '');

    const ok = ops(['release-hold']);
    expect(ok.status).toBe(0);
    expect(existsSync(join(base(), 'HOLD_APP'))).toBe(false);
    expect(dockerLog()).toMatch(/up -d --remove-orphans db caddy app/);

    writeFileSync(join(base(), 'release.prev'), OLD);
    writeFileSync(join(base(), 'HOLD_APP'), '');
    const bad = ops(['release-hold'], { FAKE_HEALTHY: OLD });
    expect(bad.status).toBe(1);
    expect(read('release')).toBe(OLD);
  });

  it('при HOLD_APP restart-app и rollback отказываются', () => {
    seedRelease(NEW);
    writeFileSync(join(base(), 'release.prev'), OLD);
    writeFileSync(join(base(), 'HOLD_APP'), '');

    expect(ops(['restart-app']).status).toBe(1);
    expect(ops(['rollback']).status).toBe(1);
    expect(read('release')).toBe(NEW);
  });

  it('rollback: возвращает prev и стирает его — второй rollback не вернёт откатанный релиз', () => {
    seedRelease(NEW);
    writeFileSync(join(base(), 'release.prev'), OLD);

    expect(ops(['rollback'], { FAKE_HEALTHY: OLD }).status).toBe(0);
    expect(read('release')).toBe(OLD);
    expect(ops(['rollback'], { FAKE_HEALTHY: OLD }).status).toBe(1);
    expect(read('release')).toBe(OLD);
  });

  it('токен ghcr не попадает в вывод и в аргументы docker, вход идёт через stdin', () => {
    seedRelease(OLD);

    const res = deploy(NEW);

    expect(res.stdout + res.stderr).not.toContain(TOKEN);
    expect(dockerLog()).not.toContain(TOKEN);
    expect(dockerLog()).toMatch(/login ghcr.io -u octocat --password-stdin/);
  });

  it('деплой без токена, с левым образом или sha не стартует', () => {
    expect(ops(['deploy', IMAGE, NEW, 'octocat'], {}, '').status).toBe(1);
    expect(
      ops(['deploy', 'evil.io/x', NEW, 'octocat'], {}, `${TOKEN}\n`).status,
    ).toBe(1);
    expect(
      ops(['deploy', IMAGE, '$(touch pwned)', 'octocat'], {}, `${TOKEN}\n`)
        .status,
    ).toBe(1);
    expect(dockerLog()).toBe('');
  });

  it('неизвестная операция отвергается', () => {
    const res = ops(['bash', '-c', 'id']);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('неизвестная операция');
  });

  describe('write-env', () => {
    it('отбрасывает DATABASE_URL/RECOVER_CMD/TRANSFER_TARGET_URL, комментарии и CR; chmod 600; значения не печатает', () => {
      const input = [
        '# комментарий',
        'BOT_TOKEN=12345:AAA$bbb#ccc\r',
        '',
        'DATABASE_URL=postgresql://amvera/old',
        'RECOVER_CMD=bash deploy/transfer-db.sh',
        'TRANSFER_TARGET_URL=postgresql://x',
        'ENCRYPTION_KEY=deadbeef',
      ].join('\n');

      const res = ops(['write-env'], {}, input + '\n');

      expect(res.status).toBe(0);
      expect(read('.env')).toBe(
        'BOT_TOKEN=12345:AAA$bbb#ccc\nENCRYPTION_KEY=deadbeef\n',
      );
      expect(res.stdout).toMatch(/переменных 2, отброшено 3/);
      expect(res.stdout + res.stderr).not.toMatch(/AAA|deadbeef|amvera/);
      const mode = spawnSync('stat', ['-c', '%a', join(base(), '.env')], {
        encoding: 'utf8',
      });
      expect(mode.stdout.trim()).toBe('600');
    });

    it('строка не вида KEY=value → отказ без перезаписи .env; в сообщении только номер строки', () => {
      writeFileSync(join(base(), '.env'), 'OLD=1\n');

      const res = ops(['write-env'], {}, 'A=1\nsecret-without-equals\n');

      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/строки не вида KEY=value.*2/);
      expect(res.stderr).not.toContain('secret-without-equals');
      expect(read('.env')).toBe('OLD=1\n');
    });

    it('пустой ввод → отказ', () => {
      expect(ops(['write-env'], {}, '\n').status).toBe(1);
    });
  });

  it('transfer-open ставит HOLD_APP и TRANSFER_OPEN и останавливает приложение; transfer-close снимает порт', () => {
    expect(ops(['transfer-open']).status).toBe(0);
    expect(existsSync(join(base(), 'HOLD_APP'))).toBe(true);
    expect(existsSync(join(base(), 'TRANSFER_OPEN'))).toBe(true);
    expect(dockerLog()).toMatch(/stop app/);

    expect(ops(['transfer-close']).status).toBe(0);
    expect(existsSync(join(base(), 'TRANSFER_OPEN'))).toBe(false);
    expect(existsSync(join(base(), 'HOLD_APP'))).toBe(true); // приложение отпускает только release-hold
  });

  describe('restore-b2 (план Б: восстановление из бэкапа B2)', () => {
    const HOLD = () => writeFileSync(join(base(), 'HOLD_APP'), '');
    const runCalls = () =>
      dockerLog()
        .split('\ndocker ')
        .filter((l) => /\brun --rm --no-deps\b/.test(l));
    const READY = {
      FAKE_RUN_OUT:
        '[fetch-b2] ok schemehappens-2026-10-09.sql.gz.enc размер 123 байт, дата 2026-10-09',
      FAKE_MIGS: '250',
      FAKE_USERS: '7',
    };

    it('без HOLD_APP отказывается и ничего не запускает', () => {
      seedRelease(NEW);

      const res = ops(['restore-b2'], READY);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('нужен HOLD_APP');
      expect(dockerLog()).toBe('');
    });

    it('без релиза: понятная ошибка «сначала деплой», контейнер не запускается', () => {
      HOLD();

      const res = ops(['restore-b2'], READY);

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('сначала деплой');
      expect(runCalls()).toHaveLength(0);
    });

    it('в базе уже есть таблицы → отказ, заливка не начата, схему не трогали', () => {
      seedRelease(NEW);
      HOLD();

      const res = ops(['restore-b2'], { ...READY, FAKE_TABLES: '12' });

      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/ОТКАЗ: в базе уже есть таблицы \(всего 12\)/);
      expect(runCalls()).toHaveLength(0);
      expect(dockerLog()).not.toContain('DROP SCHEMA');
    });

    it('счастливый путь: db поднята, контейнер с --entrypoint, числа и имя файла в выводе, HOLD_APP остаётся', () => {
      seedRelease(NEW);
      HOLD();

      const res = ops(['restore-b2'], READY);

      expect(res.status).toBe(0);
      expect(dockerLog()).toMatch(/up -d db\n/);
      const calls = runCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatch(
        /run --rm --no-deps -T --entrypoint bash app -c /,
      );
      expect(calls[0]).toContain('scripts/fetch-latest-b2.sh');
      expect(calls[0]).toContain('scripts/restore-backup.sh');
      expect(res.stdout).toContain('schemehappens-2026-10-09.sql.gz.enc');
      expect(res.stdout).toContain('строк в _prisma_migrations: 250');
      expect(res.stdout).toContain('строк в "User": 7');
      expect(existsSync(join(base(), 'HOLD_APP'))).toBe(true);
      expect(dockerLog()).not.toContain('DROP SCHEMA');
      // приложение не поднимали
      expect(dockerLog()).not.toMatch(/up -d .* app/);
    });

    it('контейнер упал → неполная заливка сброшена, код 1, HOLD_APP на месте', () => {
      seedRelease(NEW);
      HOLD();

      const res = ops(['restore-b2'], { ...READY, FAKE_RUN_EXIT: '1' });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('восстановление из B2 не удалось');
      expect(dockerLog()).toContain('DROP SCHEMA public CASCADE');
      expect(existsSync(join(base(), 'HOLD_APP'))).toBe(true);
    });

    it('после «успеха» в _prisma_migrations пусто → код 1 (бэкап не от этого приложения)', () => {
      seedRelease(NEW);
      HOLD();

      const res = ops(['restore-b2'], { ...READY, FAKE_MIGS: '0' });

      expect(res.status).toBe(1);
      expect(res.stderr).toContain('в _prisma_migrations нет строк');
    });

    describe('скрипт внутри контейнера (выполняется по-настоящему)', () => {
      let app: string;
      beforeEach(() => {
        app = join(dir, 'app');
        mkdirSync(join(app, 'scripts'), { recursive: true });
        writeFileSync(
          join(app, 'scripts', 'fetch-latest-b2.sh'),
          '#!/bin/bash\nmkdir -p "$1"; : > "$1/schemehappens-2026-10-09.sql.gz.enc"\n' +
            'echo "[fetch-b2] ok schemehappens-2026-10-09.sql.gz.enc размер 5 байт, дата 2026-10-09"\n',
        );
        writeFileSync(
          join(app, 'scripts', 'restore-backup.sh'),
          [
            '#!/bin/bash',
            'echo "CREATE TABLE"; echo "[restore] контрольная сумма сошлась"',
            'if [ -n "${RESTORE_FAIL:-}" ]; then',
            '  echo "psql:x.sql:5: ERROR:  invalid input syntax for type integer" >&2',
            '  echo "CONTEXT:  COPY User, line 1: \\"СТРОКА-ИЗ-ТАБЛИЦЫ\\"" >&2',
            '  echo "DETAIL:  Key (email)=(СТРОКА-ИЗ-ТАБЛИЦЫ) already exists." >&2',
            '  exit 1',
            'fi',
            'echo "[restore] готово — БД заполнена из $1"',
          ].join('\n'),
        );
        seedRelease(NEW);
        HOLD();
      });
      const exec = (env: Record<string, string> = {}) =>
        ops(['restore-b2'], {
          ...READY,
          FAKE_RUN_EXEC: '1',
          FAKE_RUN_CWD: app,
          ...env,
        });

      it('успех: имя восстановленного файла печатается, шум заливки — нет, адрес базы — нет', () => {
        const res = exec();

        expect(res.status).toBe(0);
        expect(res.stdout).toContain(
          'восстановлен файл: schemehappens-2026-10-09.sql.gz.enc',
        );
        expect(res.stdout).toContain('[restore] готово');
        expect(res.stdout).not.toContain('CREATE TABLE');
        expect(res.stdout + res.stderr).not.toContain('RUNSECRETPW');
      });

      it('ошибка заливки: наружу только строки ERROR, без CONTEXT/DETAIL со значениями из таблиц', () => {
        const res = exec({ RESTORE_FAIL: '1' });

        expect(res.status).toBe(1);
        expect(res.stderr).toContain('ERROR:  invalid input syntax');
        expect(res.stdout + res.stderr).not.toContain('СТРОКА-ИЗ-ТАБЛИЦЫ');
        expect(res.stdout + res.stderr).not.toContain('RUNSECRETPW');
        expect(dockerLog()).toContain('DROP SCHEMA public CASCADE');
      });
    });
  });

  describe('external-db-check', () => {
    const PW = 'pwSECRET0123456789abcdef';
    const IP = '203.0.113.7';
    const URL = `postgresql://postgres:${PW}@${IP}:5432/schemehappens?sslmode=require&uselibpqcompat=true&sslaccept=accept_invalid_certs`;
    beforeEach(() => {
      writeFileSync(join(base(), 'db.env'), `POSTGRES_PASSWORD=${PW}\n`);
      seedRelease(NEW);
      writeFileSync(join(base(), 'TRANSFER_OPEN'), '');
    });
    const check = (env: Record<string, string> = {}) =>
      ops(['external-db-check'], { OPS_PUBLIC_IP: IP, ...env });

    it('собирает строку для Amvera (публичный IP, пароль из db.env, три параметра TLS), а наружу её не отдаёт', () => {
      const res = check({
        FAKE_CHECK_OUT: '[db-check] 1/3 prisma migrate status: ok\n',
      });

      expect(res.status).toBe(0);
      expect(readFileSync(join(dir, 'db-url'), 'utf8')).toBe(URL);
      const all = res.stdout + res.stderr + dockerLog();
      expect(all).not.toContain(PW);
      expect(all).not.toContain('postgresql://');
      expect(res.stdout).toContain('[db-check] 1/3');
      expect(dockerLog()).toMatch(
        new RegExp(
          `docker run --rm --network host -e DATABASE_URL -v \\S+/external-db-check.sh:/tmp/external-db-check.sh:ro --entrypoint bash ghcr.io/owner/repo:${NEW} /tmp/external-db-check.sh`,
        ),
      );
    });

    it('проверка не прошла → код 1', () => {
      const res = check({ FAKE_CHECK_EXIT: '1' });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('проверка внешнего подключения не прошла');
    });

    it('порт закрыт (нет TRANSFER_OPEN) → отказ без запуска контейнера', () => {
      rmSync(join(base(), 'TRANSFER_OPEN'));
      const res = check();
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('сначала op=transfer-open');
      expect(dockerLog()).not.toContain('docker run');
    });

    it('без релиза → «сначала деплой»', () => {
      rmSync(join(base(), 'release'));
      const res = check();
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('сначала деплой');
    });

    it('пароль с символами, ломающими URL → отказ, а не битая строка', () => {
      writeFileSync(join(base(), 'db.env'), 'POSTGRES_PASSWORD=p@ss/word\n');
      const res = check();
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('кодировать в URL');
      expect(res.stdout + res.stderr).not.toContain('p@ss');
    });
  });

  it('transfer-close падает, если порт 5432 всё ещё опубликован', () => {
    const res = ops(['transfer-close'], { FAKE_PORT_OPEN: '1' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('всё ещё опубликован');
  });
});
