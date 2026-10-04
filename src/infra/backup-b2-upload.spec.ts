// Загрузка бэкапа в B2 и хранение (scripts/backup-to-b2.sh, аудит D-2).
// Скрипт гоняется по-настоящему против ПОДДЕЛЬНОГО B2 — локального HTTP-сервера,
// который отвечает по контракту родного API v3 (authorize → list_buckets →
// get_upload_url → upload; list_file_versions → delete_file_version). В образе
// нет ни `b2`, ни `aws` CLI, поэтому весь путь — curl + node -e: проверять его
// остаётся только исполнением. `curl` в PATH подменён обёрткой, пишущей
// аргументы в лог, — так доказывается, что ключ и токены не в командной строке.
import { spawn, spawnSync } from 'child_process';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
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

// Каждый прогон скрипта — три PBKDF2 по 200 000 итераций; под нагрузкой параллельного jest 5 с мало.
jest.setTimeout(90_000);

const BACKUP = join(process.cwd(), 'scripts', 'backup-to-b2.sh');
const RESTORE = join(process.cwd(), 'scripts', 'restore-backup.sh');
const KEY_ID = 'keyid123';
const APP_KEY = 'APPKEY-super-secret-value';
const BACKUP_KEY = 'backup-key-' + 'z'.repeat(30);

interface Recorded {
  path: string;
  headers: IncomingMessage['headers'];
  body: Buffer;
}
interface Fake {
  server: Server;
  url: string;
  requests: Recorded[];
  uploads: Map<string, Buffer>;
  deleted: string[];
  // Настройки поведения.
  versions: Array<{ fileName: string; fileId: string }>;
  failListVersions: boolean;
  authStatus: number;
  breakSha1: boolean;
}

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function startFakeB2(): Promise<Fake> {
  const fake = {
    requests: [],
    uploads: new Map(),
    deleted: [],
    versions: [],
    failListVersions: false,
    authStatus: 200,
    breakSha1: false,
  } as unknown as Fake;
  const json = (res: ServerResponse, body: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  fake.server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const path = req.url ?? '';
      fake.requests.push({ path, headers: req.headers, body });
      const payload = () => JSON.parse(body.toString() || '{}');
      if (path.endsWith('/b2_authorize_account')) {
        const basic = Buffer.from(`${KEY_ID}:${APP_KEY}`).toString('base64');
        if (
          fake.authStatus !== 200 ||
          req.headers.authorization !== `Basic ${basic}`
        ) {
          return json(res, { code: 'unauthorized', message: 'bad key' }, 401);
        }
        return json(res, {
          accountId: 'acc1',
          authorizationToken: 'AUTH-TOKEN-xyz',
          apiInfo: { storageApi: { apiUrl: fake.url } },
        });
      }
      if (path.endsWith('/b2_list_buckets')) {
        return json(res, {
          buckets: [{ bucketId: 'bkt-id-1', bucketName: payload().bucketName }],
        });
      }
      if (path.endsWith('/b2_get_upload_url')) {
        return json(res, {
          uploadUrl: `${fake.url}/upload-target`,
          authorizationToken: 'UPLOAD-TOKEN-abc',
        });
      }
      if (path === '/upload-target') {
        const name = decodeURIComponent(String(req.headers['x-bz-file-name']));
        fake.uploads.set(name, body);
        const sha1 = fake.breakSha1
          ? 'f'.repeat(40)
          : createHash('sha1').update(body).digest('hex');
        return json(res, {
          fileName: name,
          fileId: `id-${name}`,
          contentSha1: sha1,
        });
      }
      if (path.endsWith('/b2_list_file_versions')) {
        if (fake.failListVersions) return json(res, { code: 'boom' }, 500);
        const p = payload();
        // Две страницы: первая отдаёт один файл и курсор.
        const startIdx = p.startFileName ? 1 : 0;
        const page =
          startIdx === 0 ? fake.versions.slice(0, 1) : fake.versions.slice(1);
        return json(res, {
          files: page,
          nextFileName:
            startIdx === 0 && fake.versions.length > 1
              ? fake.versions[1].fileName
              : null,
          nextFileId:
            startIdx === 0 && fake.versions.length > 1
              ? fake.versions[1].fileId
              : null,
        });
      }
      if (path.endsWith('/b2_delete_file_version')) {
        fake.deleted.push(`${payload().fileName}#${payload().fileId}`);
        return json(res, {});
      }
      return json(res, { code: 'not_found' }, 404);
    });
  });
  await new Promise<void>((r) => fake.server.listen(0, '127.0.0.1', r));
  fake.url = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`;
  return fake;
}

describe('backup-to-b2.sh → B2 (поддельный сервер)', () => {
  let dir: string;
  let fake: Fake;
  let curlLog: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'b2-spec-'));
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    curlLog = join(dir, 'curl.log');
    writeFileSync(
      join(bin, 'pg_dump'),
      `#!/bin/bash\necho "-- dump marker ${randomBytes(4).toString('hex')}"\n`,
      { mode: 0o755 },
    );
    const realCurl = spawnSync('which', ['curl'], {
      encoding: 'utf8',
    }).stdout.trim();
    writeFileSync(
      join(bin, 'curl'),
      `#!/bin/bash\necho "curl $*" >> '${curlLog}'\nexec ${realCurl} "$@"\n`,
      { mode: 0o755 },
    );
    fake = await startFakeB2();
  });
  afterEach(async () => {
    await new Promise((r) => fake.server.close(r));
    rmSync(dir, { recursive: true, force: true });
  });

  function run(extra: Record<string, string> = {}) {
    return new Promise<{ code: number; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn('bash', [BACKUP], {
          env: {
            ...process.env,
            PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
            DATABASE_URL: 'postgresql://u:p@dbhost/db',
            BACKUP_ENCRYPTION_KEY: BACKUP_KEY,
            ENCRYPTION_KEY: '',
            B2_KEY_ID: KEY_ID,
            B2_APP_KEY: APP_KEY,
            B2_BUCKET: 'my-bucket',
            B2_AUTH_URL: `${fake.url}/b2api/v3/b2_authorize_account`,
            ...extra,
          },
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d));
        child.stderr.on('data', (d) => (stderr += d));
        child.on('close', (code) =>
          resolve({ code: code ?? -1, stdout, stderr }),
        );
      },
    );
  }

  it('загружает зашифрованный файл и .sha256 в бакет под именем schemehappens-<дата>', async () => {
    const res = await run();
    expect(res.code).toBe(0);
    const names = [...fake.uploads.keys()].sort();
    expect(names).toHaveLength(2);
    expect(names[0]).toMatch(/^schemehappens-\d{4}-\d{2}-\d{2}\.sql\.gz\.enc$/);
    expect(names[1]).toBe(`${names[0]}.sha256`);
    expect(res.stdout.trim().split('\n').pop()).toBe(`[backup] ok ${names[0]}`);
  });

  it('заголовки загрузки по контракту B2: Authorization, X-Bz-File-Name, Content-Type b2/x-auto, SHA1 тела', async () => {
    await run();
    const up = fake.requests.filter((r) => r.path === '/upload-target')[0];
    expect(up.headers.authorization).toBe('UPLOAD-TOKEN-abc');
    expect(up.headers['content-type']).toBe('b2/x-auto');
    expect(up.headers['x-bz-content-sha1']).toBe(
      createHash('sha1').update(up.body).digest('hex'),
    );
    // Бакет найден по имени через b2_list_buckets, его id ушёл в get_upload_url.
    const getUrl = fake.requests.find((r) =>
      r.path.endsWith('/b2_get_upload_url'),
    )!;
    expect(JSON.parse(getUrl.body.toString()).bucketId).toBe('bkt-id-1');
  });

  // Связка «записали → прочитали»: то, что реально лежит в бакете, обязано
  // восстанавливаться штатным restore-backup.sh вместе с .sha256 из бакета.
  it('загруженное восстанавливается restore-backup.sh (с проверкой .sha256 из бакета)', async () => {
    await run();
    const [name] = [...fake.uploads.keys()].filter((n) => n.endsWith('.enc'));
    const encFile = join(dir, name);
    writeFileSync(encFile, fake.uploads.get(name)!);
    writeFileSync(`${encFile}.sha256`, fake.uploads.get(`${name}.sha256`)!);
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

  it('ключ приложения B2 и токены не попадают в командную строку curl и в вывод', async () => {
    const res = await run();
    const log = readFileSync(curlLog, 'utf8');
    for (const secret of [
      APP_KEY,
      'AUTH-TOKEN-xyz',
      'UPLOAD-TOKEN-abc',
      BACKUP_KEY,
    ]) {
      expect(log).not.toContain(secret);
      expect(res.stdout + res.stderr).not.toContain(secret);
    }
  });

  describe('хранение', () => {
    const old = (n: number, ext = 'sql.gz.enc') =>
      `schemehappens-${daysAgo(n)}.${ext}`;

    it('удаляет ВСЕ версии файлов старше BACKUP_RETENTION_DAYS (в т.ч. .sha256), свежие и чужие не трогает; читает все страницы', async () => {
      fake.versions = [
        { fileName: old(100), fileId: 'v1' },
        { fileName: old(100), fileId: 'v1b' }, // вторая версия того же имени
        { fileName: old(100, 'sql.gz.enc.sha256'), fileId: 'v2' },
        { fileName: old(10), fileId: 'fresh' },
        { fileName: 'schemehappens-2001-01-01.txt', fileId: 'alien' },
        { fileName: old(60), fileId: 'v3' },
      ];
      const res = await run({ BACKUP_RETENTION_DAYS: '30' });
      expect(res.code).toBe(0);
      expect(fake.deleted.sort()).toEqual(
        [
          `${old(100)}#v1`,
          `${old(100)}#v1b`,
          `${old(100, 'sql.gz.enc.sha256')}#v2`,
          `${old(60)}#v3`,
        ].sort(),
      );
      expect(res.stdout).toContain('удалено версий старше 30 дн.');
    });

    it('по умолчанию хранит 90 дней: файл 60-дневной давности остаётся', async () => {
      fake.versions = [
        { fileName: old(60), fileId: 'keep' },
        { fileName: old(120), fileId: 'drop' },
      ];
      await run();
      expect(fake.deleted).toEqual([`${old(120)}#drop`]);
    });

    it('сбой списка файлов — бэкап всё равно успешен (код 0), в stderr WARN', async () => {
      fake.failListVersions = true;
      const res = await run();
      expect(res.code).toBe(0);
      expect(res.stdout.trim().split('\n').pop()).toMatch(/^\[backup\] ok /);
      expect(res.stderr).toMatch(/WARN: чистка старых бэкапов не удалась/);
      expect(fake.deleted).toEqual([]);
    });
  });

  describe('отказы', () => {
    it('B2 не принял ключ (401) — FAILED, код ≠ 0, ключ в сообщении не светится', async () => {
      fake.authStatus = 401;
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(
        /\[backup\] FAILED B2: авторизация не удалась/,
      );
      expect(res.stderr).not.toContain(APP_KEY);
      expect(fake.uploads.size).toBe(0);
    });

    it('B2 вернул не тот SHA1 после загрузки — FAILED (загрузка не считается успешной)', async () => {
      fake.breakSha1 = true;
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/контрольная сумма загруженного/);
      expect(res.stdout).not.toMatch(/\[backup\] ok /);
    });

    it('сервер B2 недоступен — FAILED, не зависание', async () => {
      const res = await run({
        B2_AUTH_URL: 'http://127.0.0.1:1/b2_authorize_account',
      });
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/\[backup\] FAILED/);
    });
  });
});
