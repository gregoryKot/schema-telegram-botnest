// Загрузка бэкапа в хранилище и чистка старых (scripts/backup-upload.sh,
// аудит D-2). Скрипт гоняется по-настоящему против ПОДДЕЛЬНОГО S3
// (src/test-support/fake-s3.ts), который пересчитывает подпись SigV4
// настоящего curl модулем s3-sigv4.ts, — зелёный прогон значит, что подпись
// curl принята бы и хранилищем. В образе нет ни aws CLI, ни rclone: весь путь
// — curl + node -e, проверять его остаётся только исполнением. `curl` в PATH
// подменён обёрткой, пишущей аргументы в лог, — так доказывается, что ключи
// не в командной строке.
import { spawnSync } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FAKE_S3_SECRET, FakeS3 } from '../test-support/fake-s3';
import { installCurlSpy, runScript } from '../test-support/run-script';

// Каждый прогон скрипта — три PBKDF2 по 200 000 итераций; под нагрузкой параллельного jest 5 с мало.
jest.setTimeout(90_000);

const BACKUP = join(process.cwd(), 'scripts', 'backup-upload.sh');
const RESTORE = join(process.cwd(), 'scripts', 'restore-backup.sh');
const BACKUP_KEY = 'backup-key-' + 'z'.repeat(30);

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe('backup-upload.sh → S3 (поддельный сервер, подпись curl сверяется)', () => {
  let dir: string;
  let s3: FakeS3;
  let curlLog: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 's3-upload-spec-'));
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    curlLog = join(dir, 'curl.log');
    writeFileSync(
      join(bin, 'pg_dump'),
      `#!/bin/bash\necho "-- dump marker ${randomBytes(4).toString('hex')}"\n`,
      { mode: 0o755 },
    );
    installCurlSpy(bin, curlLog);
    s3 = await new FakeS3().start();
  });
  afterEach(async () => {
    await s3.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  const run = (extra: Record<string, string> = {}) =>
    runScript(BACKUP, [], {
      ...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      DATABASE_URL: 'postgresql://u:p@dbhost/db',
      BACKUP_ENCRYPTION_KEY: BACKUP_KEY,
      ENCRYPTION_KEY: '',
      ...s3.env(),
      ...extra,
    });

  const uploaded = () =>
    [...s3.objects.keys()]
      .filter((k) => k.endsWith('.enc') || k.endsWith('.sha256'))
      .sort();

  it('кладёт зашифрованный файл и .sha256 в бакет под именем schemehappens-<дата>', async () => {
    const res = await run();
    expect(res.stderr).toBe('');
    expect(res.code).toBe(0);
    const names = uploaded();
    expect(names).toHaveLength(2);
    expect(names[0]).toMatch(/^schemehappens-\d{4}-\d{2}-\d{2}\.sql\.gz\.enc$/);
    expect(names[1]).toBe(`${names[0]}.sha256`);
    expect(res.stdout.trim().split('\n').pop()).toBe(`[backup] ok ${names[0]}`);
  });

  it('запросы по контракту S3: PUT path-style, подпись SigV4 c регионом auto, x-amz-content-sha256 = SHA-256 тела', async () => {
    await run();
    const puts = s3.requests.filter((r) => r.method === 'PUT');
    expect(puts.map((r) => r.path).sort()).toEqual(
      uploaded().map((k) => `/my-bucket/${k}`),
    );
    for (const put of puts) {
      expect(put.headers.authorization).toMatch(
        /^AWS4-HMAC-SHA256 Credential=\w+\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=[^,]*x-amz-content-sha256/,
      );
      expect(put.headers['x-amz-content-sha256']).toBe(
        createHash('sha256').update(put.body).digest('hex'),
      );
    }
  });

  it('BACKUP_S3_REGION меняет регион в подписи', async () => {
    const res = await run({ BACKUP_S3_REGION: 'eu-central-1' });
    expect(res.code).toBe(0);
    expect(s3.requests[0].headers.authorization).toContain(
      '/eu-central-1/s3/aws4_request',
    );
  });

  // Связка «записали → прочитали»: то, что реально лежит в бакете, обязано
  // восстанавливаться штатным restore-backup.sh вместе с .sha256 из бакета.
  it('загруженное восстанавливается restore-backup.sh (с проверкой .sha256 из бакета)', async () => {
    await run();
    const [name] = uploaded();
    const encFile = join(dir, name);
    writeFileSync(encFile, s3.objects.get(name)!.content);
    writeFileSync(
      `${encFile}.sha256`,
      s3.objects.get(`${name}.sha256`)!.content,
    );
    const res = spawnSync('bash', [RESTORE, encFile], {
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: BACKUP_KEY },
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('контрольная сумма сошлась');
    expect(
      readFileSync(encFile.replace(/\.sql\.gz\.enc$/, '.sql'), 'utf8'),
    ).toContain('-- dump marker');
  });

  it('секрет хранилища и ключ бэкапов не попадают в командную строку curl и в вывод', async () => {
    const res = await run();
    const log = readFileSync(curlLog, 'utf8');
    expect(log).toContain('--aws-sigv4'); // обёртка действительно видела вызовы
    for (const secret of [FAKE_S3_SECRET, BACKUP_KEY]) {
      expect(log).not.toContain(secret);
      expect(res.stdout + res.stderr).not.toContain(secret);
    }
  });

  describe('хранение', () => {
    const old = (n: number, ext = 'sql.gz.enc') =>
      `schemehappens-${daysAgo(n)}.${ext}`;

    it('удаляет файлы возрастом от BACKUP_RETENTION_DAYS (в т.ч. .sha256), свежие и чужие не трогает; читает все страницы', async () => {
      s3.pageSize = 2;
      for (const k of [
        old(100),
        old(100, 'sql.gz.enc.sha256'),
        old(10),
        old(29),
        old(30),
      ])
        s3.add(k, 'x');
      s3.add('schemehappens-2001-01-01.txt', 'alien');
      s3.add('other-2001-01-01.sql.gz.enc', 'alien');
      const res = await run({ BACKUP_RETENTION_DAYS: '30' });
      expect(res.code).toBe(0);
      const deleted = s3.requests
        .filter((r) => r.method === 'DELETE')
        .map((r) => r.path.replace('/my-bucket/', ''));
      // Граница: 30-дневный файл уже удаляется — копия живёт не дольше срока,
      // который политика обещает для удалённых из базы данных.
      expect(deleted.sort()).toEqual(
        [old(100), old(100, 'sql.gz.enc.sha256'), old(30)].sort(),
      );
      expect(s3.objects.has(old(10))).toBe(true);
      expect(s3.objects.has(old(29))).toBe(true);
      expect(s3.objects.has('schemehappens-2001-01-01.txt')).toBe(true);
      expect(res.stdout).toContain('удалено файлов возрастом от 30 дн.');
      // Листинг шёл страницами с курсором.
      expect(
        s3.requests.filter((r) => r.query.get('continuation-token')).length,
      ).toBeGreaterThan(0);
    });

    it('по умолчанию хранит 30 дней: 20-дневный файл остаётся, 40-дневный удаляется', async () => {
      s3.add(old(20), 'keep');
      s3.add(old(40), 'drop');
      await run();
      expect(s3.objects.has(old(20))).toBe(true);
      expect(s3.objects.has(old(40))).toBe(false);
    });

    it('срок больше 30 — бэкап идёт, хранится 30 дней, в stderr WARN', async () => {
      // Потолок — обещание политики конфиденциальности (глава 6); отказ от
      // бэкапа из-за срока был бы хуже, чем лишние копии.
      s3.add(old(20), 'keep');
      s3.add(old(60), 'drop');
      const res = await run({ BACKUP_RETENTION_DAYS: '90' });
      expect(res.code).toBe(0);
      expect(s3.objects.has(old(20))).toBe(true);
      expect(s3.objects.has(old(60))).toBe(false);
      expect(res.stderr).toMatch(/WARN: BACKUP_RETENTION_DAYS=90 больше 30/);
    });

    it('сбой списка файлов — бэкап всё равно успешен (код 0), в stderr WARN', async () => {
      s3.failList = true;
      s3.add(old(120), 'drop');
      const res = await run();
      expect(res.code).toBe(0);
      expect(res.stdout.trim().split('\n').pop()).toMatch(/^\[backup\] ok /);
      expect(res.stderr).toMatch(/WARN: чистка старых бэкапов не удалась/);
      expect(s3.objects.has(old(120))).toBe(true);
    });
  });

  describe('отказы', () => {
    it('хранилище не приняло ключ (403) — FAILED, код ≠ 0, секрет в сообщении не светится', async () => {
      s3.rejectKey = true;
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(
        /\[backup\] FAILED S3: загрузка .* не удалась: .*InvalidAccessKeyId/,
      );
      expect(res.stderr).not.toContain(FAKE_S3_SECRET);
      expect(s3.objects.size).toBe(0);
    });

    it('ETag ответа не совпал с MD5 файла — FAILED (загрузка не считается успешной)', async () => {
      s3.wrongEtag = true;
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/контрольная сумма загруженного/);
      expect(res.stdout).not.toMatch(/\[backup\] ok /);
    });

    it('хранилище недоступно — FAILED, не зависание', async () => {
      const res = await run({ BACKUP_S3_ENDPOINT: 'http://127.0.0.1:1' });
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/\[backup\] FAILED/);
    });
  });
});
