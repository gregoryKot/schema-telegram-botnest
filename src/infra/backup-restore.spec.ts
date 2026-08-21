// Репетиция restore бэкапа (аудит тестовых практик 2026-08, CLAUDE.md
// «раздел БД»): «бэкап без проверенного restore — не бэкап». До этого файла
// restore существовал только как комментарий в хвосте backup-to-b2.sh — и он
// был НЕВЕРЕН: encrypt-сторона кладёт IV как 16 СЫРЫХ байт (`xxd -r -p`), а
// комментарий читал первые 32 БАЙТА файла как «32 hex-символа» (`head -c 32`)
// и резал `tail -c +33` — по такой инструкции восстановление отдало бы мусор
// (воспроизведено и запротоколировано в PR, не только тут). Живой фикс —
// scripts/restore-backup.sh; здесь — round-trip и обязательные негативные
// пробы (щит обязан уметь падать, не только зеленеть, правило №15).
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
const BACKUP = join(process.cwd(), 'scripts', 'backup-to-b2.sh');

function runRestore(args: string[], env: Record<string, string>) {
  return spawnSync('bash', [RESTORE, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

// Зашифрованная фикстура ТЕМ ЖЕ форматом, что кладёт backup-to-b2.sh: 16
// сырых байт IV, затем AES-256-CBC(gzip(plain)) — той же openssl-командой,
// что и скрипт (строка `openssl enc -aes-256-cbc -K ... -iv ...`).
function encryptFixture(dir: string, plain: string, key: string): string {
  const dumpFile = join(dir, 'fixture.sql');
  writeFileSync(dumpFile, plain);
  const iv = randomBytes(16);
  const gz = spawnSync('gzip', ['-c', dumpFile]);
  if (gz.status !== 0) throw new Error(`gzip failed: ${gz.stderr.toString()}`);
  const enc = spawnSync(
    'openssl',
    ['enc', '-aes-256-cbc', '-K', key, '-iv', iv.toString('hex')],
    { input: gz.stdout },
  );
  if (enc.status !== 0)
    throw new Error(`openssl encrypt failed: ${enc.stderr.toString()}`);
  const encFile = join(dir, 'fixture.sql.gz.enc');
  writeFileSync(encFile, Buffer.concat([iv, enc.stdout]));
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

    const res = runRestore([encFile], { ENCRYPTION_KEY: key });

    expect(res.status).toBe(0);
    const outSql = encFile.replace(/\.sql\.gz\.enc$/, '.sql');
    expect(readFileSync(outSql, 'utf8')).toBe(plaintext);
  });

  it('порченый байт шифртекста → restore падает, .sql не остаётся (класс бага: тихий мусор вместо ошибки)', () => {
    const key = randomBytes(32).toString('hex');
    const encFile = encryptFixture(dir, 'x'.repeat(500), key);
    const buf = readFileSync(encFile);
    buf[19] ^= 0xff; // байт №20 — первый байт шифртекста (после 16-байтного IV)
    writeFileSync(encFile, buf);

    const res = runRestore([encFile], { ENCRYPTION_KEY: key });

    expect(res.status).not.toBe(0);
    expect(existsSync(encFile.replace(/\.sql\.gz\.enc$/, '.sql'))).toBe(false);
  });

  it('неверный ключ → restore падает с ненулевым кодом', () => {
    const key = randomBytes(32).toString('hex');
    const encFile = encryptFixture(dir, 'y'.repeat(500), key);
    const wrongKey = randomBytes(32).toString('hex');

    const res = runRestore([encFile], { ENCRYPTION_KEY: wrongKey });

    expect(res.status).not.toBe(0);
  });

  it('без ENCRYPTION_KEY — падает сразу, не пытается расшифровать', () => {
    const res = runRestore([join(dir, 'whatever.sql.gz.enc')], {
      ENCRYPTION_KEY: '',
    });

    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/ENCRYPTION_KEY/);
  });

  it('файл не найден — понятная ошибка, не мусор от openssl/gunzip', () => {
    const key = randomBytes(32).toString('hex');

    const res = runRestore([join(dir, 'nope.sql.gz.enc')], {
      ENCRYPTION_KEY: key,
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
        ENCRYPTION_KEY: key,
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

    const restoreRes = runRestore([encFile], { ENCRYPTION_KEY: key });

    expect(restoreRes.status).toBe(0);
    expect(
      readFileSync(encFile.replace(/\.sql\.gz\.enc$/, '.sql'), 'utf8'),
    ).toContain(dumpMarker);
  });
});
