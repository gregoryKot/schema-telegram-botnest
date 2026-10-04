// Репетиция restore бэкапа (аудит тестовых практик 2026-08, CLAUDE.md
// «раздел БД»): «бэкап без проверенного restore — не бэкап». До этого файла
// restore существовал только как комментарий в хвосте backup-to-b2.sh — и он
// был НЕВЕРЕН: encrypt-сторона кладёт IV как 16 СЫРЫХ байт (`xxd -r -p`), а
// комментарий читал первые 32 БАЙТА файла как «32 hex-символа» (`head -c 32`)
// и резал `tail -c +33` — по такой инструкции восстановление отдало бы мусор
// (воспроизведено и запротоколировано в PR, не только тут). Живой фикс —
// scripts/restore-backup.sh; здесь — round-trip и обязательные негативные
// пробы (щит обязан уметь падать, не только зеленеть, правило №15).
// Формат бэкапа (аудит D-2): стандартный `openssl enc -aes-256-cbc -pbkdf2
// -iter 200000 -salt -pass env:BACKUP_ENCRYPTION_KEY` — ключ не в командной
// строке, отдельный от ENCRYPTION_KEY, рядом лежит .sha256. Загрузка в B2 и
// хранение — backup-b2-upload.spec.ts.
// Реальный Postgres end-to-end (миграции → маркер → бэкап → restore во
// вторую БД → сверка схемы) — nightly.yml, джоба backup-restore.
import { spawnSync } from 'child_process';
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

const RESTORE = join(process.cwd(), 'scripts', 'restore-backup.sh');
// Каждый прогон скрипта — три PBKDF2 по 200 000 итераций; под нагрузкой параллельного jest 5 с мало.
jest.setTimeout(90_000);

const BACKUP = join(process.cwd(), 'scripts', 'backup-to-b2.sh');

function runRestore(args: string[], env: Record<string, string>) {
  return spawnSync('bash', [RESTORE, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

// Зашифрованная фикстура ТЕМ ЖЕ форматом, что кладёт backup-to-b2.sh:
// «Salted__» + соль + AES-256-CBC(gzip(plain)), ключ через -pass env:.
function encryptFixture(dir: string, plain: string, key: string): string {
  const dumpFile = join(dir, 'fixture.sql');
  writeFileSync(dumpFile, plain);
  const gz = spawnSync('gzip', ['-c', dumpFile]);
  if (gz.status !== 0) throw new Error(`gzip failed: ${gz.stderr.toString()}`);
  const enc = spawnSync(
    'openssl',
    [
      'enc',
      '-aes-256-cbc',
      '-pbkdf2',
      '-iter',
      '200000',
      '-salt',
      '-pass',
      'env:BACKUP_ENCRYPTION_KEY',
    ],
    { input: gz.stdout, env: { ...process.env, BACKUP_ENCRYPTION_KEY: key } },
  );
  if (enc.status !== 0)
    throw new Error(`openssl encrypt failed: ${enc.stderr.toString()}`);
  const encFile = join(dir, 'fixture.sql.gz.enc');
  writeFileSync(encFile, enc.stdout);
  return encFile;
}

describe('scripts/restore-backup.sh (репетиция restore)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'restore-spec-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('round-trip: восстановленный дамп идентичен исходному', () => {
    const key = randomBytes(32).toString('hex');
    const plaintext = 'CREATE TABLE fixture (id int); -- контрольный текст\n';
    const encFile = encryptFixture(dir, plaintext, key);

    const res = runRestore([encFile], { BACKUP_ENCRYPTION_KEY: key });

    expect(res.status).toBe(0);
    const outSql = encFile.replace(/\.sql\.gz\.enc$/, '.sql');
    expect(readFileSync(outSql, 'utf8')).toBe(plaintext);
  });

  it('порченый байт шифртекста → restore падает, .sql не остаётся (класс бага: тихий мусор вместо ошибки)', () => {
    const key = randomBytes(32).toString('hex');
    const encFile = encryptFixture(dir, 'x'.repeat(500), key);
    const buf = readFileSync(encFile);
    buf[19] ^= 0xff; // байт №20 — внутри первого блока шифртекста (после 16-байтного «Salted__»+соль)
    writeFileSync(encFile, buf);

    const res = runRestore([encFile], { BACKUP_ENCRYPTION_KEY: key });

    expect(res.status).not.toBe(0);
    expect(existsSync(encFile.replace(/\.sql\.gz\.enc$/, '.sql'))).toBe(false);
  });

  it('неверный ключ → restore падает с ненулевым кодом', () => {
    const key = randomBytes(32).toString('hex');
    const encFile = encryptFixture(dir, 'y'.repeat(500), key);
    const wrongKey = randomBytes(32).toString('hex');

    const res = runRestore([encFile], { BACKUP_ENCRYPTION_KEY: wrongKey });

    expect(res.status).not.toBe(0);
  });

  it('без BACKUP_ENCRYPTION_KEY — падает сразу, не пытается расшифровать', () => {
    const res = runRestore([join(dir, 'whatever.sql.gz.enc')], {
      BACKUP_ENCRYPTION_KEY: '',
    });

    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/BACKUP_ENCRYPTION_KEY/);
  });

  it('файл не найден — понятная ошибка, не мусор от openssl/gunzip', () => {
    const key = randomBytes(32).toString('hex');

    const res = runRestore([join(dir, 'nope.sql.gz.enc')], {
      BACKUP_ENCRYPTION_KEY: key,
    });

    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/не найден/);
  });

  // Связка сохранение→восстановление через ОБА скрипта разом (правило
  // «read-after-write» CLAUDE.md): backup-to-b2.sh шифрует реальным
  // пайплайном (SKIP_UPLOAD=1, pg_dump подменён фикстурой — настоящий
  // Postgres проверяет nightly.yml), restore-backup.sh обязан прочитать то,
  // что бэкап действительно записал, а не то, что мы думаем, что он пишет.
  it('backup-to-b2.sh (SKIP_UPLOAD=1) → restore-backup.sh: то, что зашифровал бэкап, восстанавливается обратно', () => {
    const fakeBinDir = join(dir, 'fakebin');
    mkdirSync(fakeBinDir);
    const dumpMarker = 'restore-rehearsal-fixture-marker';
    writeFileSync(
      join(fakeBinDir, 'pg_dump'),
      `#!/bin/bash\ncat <<'SQL'\n${dumpMarker}\nSQL\n`,
      { mode: 0o755 },
    );
    const outDir = join(dir, 'out');
    const key = randomBytes(32).toString('hex');

    const backupRes = spawnSync('bash', [BACKUP], {
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH}`,
        DATABASE_URL: 'postgresql://fake/fake',
        BACKUP_ENCRYPTION_KEY: key,
        SKIP_UPLOAD: '1',
        BACKUP_OUT_DIR: outDir,
      },
      encoding: 'utf8',
    });
    expect(backupRes.status).toBe(0);

    const [encName] = readdirSync(outDir).filter((f) =>
      f.endsWith('.sql.gz.enc'),
    );
    expect(encName).toBeDefined();
    const encFile = join(outDir, encName);

    const restoreRes = runRestore([encFile], { BACKUP_ENCRYPTION_KEY: key });

    expect(restoreRes.status).toBe(0);
    expect(
      readFileSync(encFile.replace(/\.sql\.gz\.enc$/, '.sql'), 'utf8'),
    ).toContain(dumpMarker);
  });

  it('контрольная сумма .sha256 сходится — restore идёт; не сходится — падает ДО расшифровки', () => {
    const key = randomBytes(32).toString('hex');
    const encFile = encryptFixture(dir, 'z'.repeat(300), key);
    const sum = spawnSync('sha256sum', [encFile], {
      encoding: 'utf8',
    }).stdout.split(' ')[0];
    writeFileSync(`${encFile}.sha256`, `${sum}  fixture.sql.gz.enc\n`);
    expect(runRestore([encFile], { BACKUP_ENCRYPTION_KEY: key }).status).toBe(
      0,
    );

    writeFileSync(
      `${encFile}.sha256`,
      `${'0'.repeat(64)}  fixture.sql.gz.enc\n`,
    );
    const bad = runRestore([encFile], { BACKUP_ENCRYPTION_KEY: key });
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toMatch(/контрольная сумма не совпала/);
  });

  it('старый формат (ключ ENCRYPTION_KEY, -K/-iv) не читается — подмены ключа бэкапов полем-ключом нет', () => {
    const key = randomBytes(32).toString('hex');
    const encFile = encryptFixture(dir, 'w'.repeat(300), key);
    const res = runRestore([encFile], {
      BACKUP_ENCRYPTION_KEY: '',
      ENCRYPTION_KEY: key,
    });
    expect(res.status).not.toBe(0);
  });
});

// Контракты backup-to-b2.sh, не связанные с B2: ключ, формат, утечки в argv.
describe('scripts/backup-to-b2.sh (SKIP_UPLOAD=1)', () => {
  let dir: string;
  let fakeBin: string;
  let argvLog: string;
  const KEY = 'backup-key-' + 'k'.repeat(30);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backup-spec-'));
    fakeBin = join(dir, 'fakebin');
    argvLog = join(dir, 'argv.log');
    mkdirSync(fakeBin);
    // pg_dump и openssl пишут свои аргументы в лог: проверяем, что секретов
    // в командной строке процессов нет.
    writeFileSync(
      join(fakeBin, 'pg_dump'),
      `#!/bin/bash\necho "pg_dump $* PGPASSWORD=\${PGPASSWORD:-} PGHOST=\${PGHOST:-}" >> '${argvLog}'\necho 'PLAINTEXT-DUMP-MARKER'\n`,
      { mode: 0o755 },
    );
    const realOpenssl = spawnSync('which', ['openssl'], {
      encoding: 'utf8',
    }).stdout.trim();
    writeFileSync(
      join(fakeBin, 'openssl'),
      `#!/bin/bash\necho "openssl $*" >> '${argvLog}'\nexec ${realOpenssl} "$@"\n`,
      { mode: 0o755 },
    );
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function backup(env: Record<string, string | undefined>) {
    const base: Record<string, string | undefined> = {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      DATABASE_URL:
        'postgresql://dbuser:DB-PASSWORD@dbhost:5432/appdb?schema=public',
      SKIP_UPLOAD: '1',
      BACKUP_OUT_DIR: join(dir, 'out'),
      ENCRYPTION_KEY: undefined,
      BACKUP_ENCRYPTION_KEY: KEY,
      ...env,
    };
    for (const k of Object.keys(base))
      if (base[k] === undefined) delete base[k];
    return spawnSync('bash', [BACKUP], {
      env: base,
      encoding: 'utf8',
    });
  }

  it('успех: последняя строка stdout «[backup] ok <файл>», рядом .sha256 с верной суммой', () => {
    const res = backup({});
    expect(res.status).toBe(0);
    const lines = res.stdout.trim().split('\n');
    expect(lines[lines.length - 1]).toMatch(
      /^\[backup\] ok schemehappens-\d{4}-\d{2}-\d{2}\.sql\.gz\.enc$/,
    );
    const name = lines[lines.length - 1].replace('[backup] ok ', '');
    const sidecar = readFileSync(join(dir, 'out', `${name}.sha256`), 'utf8');
    const actual = spawnSync('sha256sum', [join(dir, 'out', name)], {
      encoding: 'utf8',
    }).stdout.split(' ')[0];
    expect(sidecar.startsWith(`${actual}  ${name}`)).toBe(true);
  });

  it('формат — openssl Salted__ (pbkdf2), шифртекст не содержит открытого дампа', () => {
    backup({});
    const [name] = readdirSync(join(dir, 'out')).filter((f) =>
      f.endsWith('.enc'),
    );
    const bytes = readFileSync(join(dir, 'out', name));
    expect(bytes.subarray(0, 8).toString('latin1')).toBe('Salted__');
    expect(bytes.includes('PLAINTEXT-DUMP-MARKER')).toBe(false);
  });

  it('ни ключ бэкапа, ни пароль БД не попадают в командную строку pg_dump/openssl; пароль едет в PGPASSWORD', () => {
    expect(backup({}).status).toBe(0);
    const log = readFileSync(argvLog, 'utf8');
    expect(log).not.toContain(KEY);
    expect(log).not.toContain('postgresql://');
    // В argv pg_dump пароля нет; он виден в логе только как значение PGPASSWORD=.
    const pgLine = log.split('\n').find((l) => l.startsWith('pg_dump'))!;
    expect(pgLine.split(' PGPASSWORD=')[0]).not.toContain('DB-PASSWORD');
    expect(pgLine).toContain('PGPASSWORD=DB-PASSWORD');
    expect(pgLine).toContain('PGHOST=dbhost');
    expect(log).toContain('-pass env:BACKUP_ENCRYPTION_KEY');
    expect(log).toContain('-pbkdf2');
  });

  it('DATABASE_URL и ключи не печатаются ни в stdout, ни в stderr', () => {
    const res = backup({});
    for (const secret of ['DB-PASSWORD', KEY, 'postgresql://']) {
      expect(res.stdout + res.stderr).not.toContain(secret);
    }
  });

  it('ключ бэкапа обязателен: без BACKUP_ENCRYPTION_KEY падает, ENCRYPTION_KEY не подставляется', () => {
    const res = backup({
      BACKUP_ENCRYPTION_KEY: undefined,
      ENCRYPTION_KEY: 'f'.repeat(64),
    });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(
      /\[backup\] FAILED не задана переменная BACKUP_ENCRYPTION_KEY/,
    );
    expect(existsSync(join(dir, 'out'))).toBe(false);
  });

  it('ключ короче 32 символов — FAILED', () => {
    const res = backup({ BACKUP_ENCRYPTION_KEY: 'short' });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/короче 32/);
  });

  it('ключ бэкапа совпадает с ENCRYPTION_KEY — FAILED (ключи обязаны быть разными)', () => {
    const res = backup({ ENCRYPTION_KEY: KEY });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/обязан быть отдельным/);
  });

  it('BACKUP_RETENTION_DAYS меньше 7 или не число — FAILED до дампа', () => {
    for (const bad of ['3', 'abc', '0']) {
      const res = backup({ BACKUP_RETENTION_DAYS: bad });
      expect(res.status).not.toBe(0);
      expect(res.stderr).toMatch(/BACKUP_RETENTION_DAYS/);
    }
  });

  it('pg_dump упал — FAILED, код ≠ 0, файла бэкапа нет (не «успех» с обрезанным дампом)', () => {
    writeFileSync(
      join(fakeBin, 'pg_dump'),
      '#!/bin/bash\necho partial\nexit 1\n',
      {
        mode: 0o755,
      },
    );
    const res = backup({});
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/\[backup\] FAILED/);
    expect(existsSync(join(dir, 'out'))).toBe(false);
  });

  it('пустой дамп — FAILED, а не зашифрованная пустота', () => {
    writeFileSync(join(fakeBin, 'pg_dump'), '#!/bin/bash\nexit 0\n', {
      mode: 0o755,
    });
    const res = backup({});
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/дамп пустой/);
  });

  it('без SKIP_UPLOAD нужны B2_*: не заданы — FAILED с именем переменной', () => {
    const res = backup({ SKIP_UPLOAD: '0' });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/B2_KEY_ID/);
  });
});
