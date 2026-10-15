// Скачивание свежего бэкапа из хранилища (scripts/backup-fetch-latest.sh +
// общий вход в S3 scripts/s3-api.sh): первая половина аварийного
// восстановления из бэкапа (docs/MIGRATION_VPS.md, «План Б»). Скрипт гоняется
// по-настоящему против ПОДДЕЛЬНОГО S3 (src/test-support/fake-s3.ts), который
// сверяет подпись curl. `curl` в PATH подменён обёрткой, пишущей аргументы в
// лог, — так доказывается, что ключи не в командной строке. Сквозная связка с
// настоящими backup-upload.sh, restore-backup.sh и живым Postgres —
// test/restore-backup.e2e-spec.ts (джоба `migrations`).
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import { FAKE_S3_SECRET, FakeS3 } from '../test-support/fake-s3';
import { installCurlSpy, runScript } from '../test-support/run-script';

jest.setTimeout(60_000);

const FETCH = join(process.cwd(), 'scripts', 'backup-fetch-latest.sh');
const S3_API = join(process.cwd(), 'scripts', 's3-api.sh');
const BACKUP = join(process.cwd(), 'scripts', 'backup-upload.sh');
const enc = (day: string) => `schemehappens-${day}.sql.gz.enc`;

describe('backup-fetch-latest.sh → S3 (поддельный сервер)', () => {
  let dir: string;
  let out: string;
  let s3: FakeS3;
  let curlLog: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'fetch-s3-'));
    out = join(dir, 'out');
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    curlLog = join(dir, 'curl.log');
    installCurlSpy(bin, curlLog);
    s3 = await new FakeS3().start();
  });
  afterEach(async () => {
    await s3.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Кладёт в бакет пару «бэкап + контрольная сумма»; sha=false — без пары. */
  const backup = (day: string, body = `дамп ${day}`, sha = true) => {
    s3.add(enc(day), body);
    if (sha) s3.add(`${enc(day)}.sha256`, `sum-of-${day}  ${enc(day)}\n`);
  };

  const run = (args: string[] = [out], extra: Record<string, string> = {}) =>
    runScript(FETCH, args, {
      ...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      ...s3.env(),
      ...extra,
    });

  it('берёт самый свежий по дате в имени (а не по порядку загрузки), качает его и .sha256', async () => {
    backup('2026-10-07');
    backup('2026-10-09', 'самый свежий дамп');
    backup('2026-10-08');

    const res = await run();

    expect(res.stderr).toBe('');
    expect(res.code).toBe(0);
    expect(readdirSync(out).sort()).toEqual([
      enc('2026-10-09'),
      `${enc('2026-10-09')}.sha256`,
    ]);
    expect(readFileSync(join(out, enc('2026-10-09')), 'utf8')).toBe(
      'самый свежий дамп',
    );
    expect(readFileSync(join(out, `${enc('2026-10-09')}.sha256`), 'utf8')).toBe(
      `sum-of-2026-10-09  ${enc('2026-10-09')}\n`,
    );
    const size = Buffer.byteLength('самый свежий дамп');
    expect(res.stdout.trim().split('\n').pop()).toBe(
      `[fetch-backup] ok ${enc('2026-10-09')} размер ${size} байт, дата 2026-10-09`,
    );
  });

  it('читает все страницы листинга (курсор с /, + и =): свежий файл на последней странице находится', async () => {
    s3.pageSize = 2;
    for (const d of ['01', '02', '03', '04', '05', '06'])
      backup(`2026-09-${d}`);
    backup('2026-10-01');

    const res = await run();

    expect(res.code).toBe(0);
    expect(res.stdout).toContain(`берём ${enc('2026-10-01')}`);
    expect(res.stdout).toContain('бэкапов в бакете: 7');
    const lists = s3.requests.filter((r) => r.query.get('list-type') === '2');
    expect(lists.length).toBeGreaterThan(3);
    expect(lists[0].query.get('prefix')).toBe('schemehappens-');
    expect(lists[1].query.get('continuation-token')).toMatch(/^tok\/\+=/);
  });

  it('самый новый файл без .sha256 (оборванная пара) пропускается: берётся предыдущий с суммой', async () => {
    backup('2026-10-08');
    backup('2026-10-09', 'без суммы', false);

    const res = await run();

    expect(res.code).toBe(0);
    expect(readdirSync(out)).toContain(enc('2026-10-08'));
    expect(readdirSync(out)).not.toContain(enc('2026-10-09'));
    expect(res.stdout).toContain('пропущено новее без .sha256: 1');
  });

  it('посторонние имена (другой формат, чужой префикс, .sha256 без бэкапа) не считаются бэкапами', async () => {
    backup('2026-10-01');
    s3.add('schemehappens-2099-01-01.sql.gz.enc.sha256', 'orphan');
    s3.add('schemehappens-notes.txt', 'x');
    s3.add('schemehappens-2098-01-01.sql.gz', 'plain');
    s3.add('other-2099-01-01.sql.gz.enc', 'x');

    const res = await run();

    expect(res.code).toBe(0);
    expect(res.stdout).toContain(`берём ${enc('2026-10-01')}`);
  });

  describe('отказы', () => {
    it('пустой бакет → FAILED «нет бэкапов», каталог пуст', async () => {
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(
        /\[fetch-backup\] FAILED в бакете .* нет бэкапов/,
      );
      expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
    });

    it('в бакете только файлы без пар .sha256 → FAILED', async () => {
      backup('2026-10-09', 'x', false);
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/ни у одного нет парного \.sha256/);
    });

    it('хранилище не приняло ключ (403) → FAILED с кодом S3, секрет не светится', async () => {
      s3.rejectKey = true;
      backup('2026-10-09');
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(
        /\[fetch-backup\] FAILED S3: список файлов не получен: .*InvalidAccessKeyId/,
      );
      expect(res.stdout + res.stderr).not.toContain(FAKE_S3_SECRET);
    });

    it('у токена нет права чтения (скачивание 403) → FAILED с подсказкой про право на чтение', async () => {
      backup('2026-10-09');
      s3.denyRead = true;
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(
        /скачивание .* не удалось \(у токена есть право на чтение\?\)/,
      );
    });

    it('обрезанный при скачивании файл (размер) → FAILED', async () => {
      backup('2026-10-09', 'длинный дамп');
      s3.truncate.add(enc('2026-10-09'));
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/размер скачанного/);
    });

    it('файл, испорченный при скачивании (MD5 против ETag) → FAILED', async () => {
      backup('2026-10-09', 'длинный дамп');
      s3.corrupt.add(enc('2026-10-09'));
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/MD5 скачанного/);
    });

    it('хранилище недоступно → FAILED, не зависание', async () => {
      const res = await run([out], {
        BACKUP_S3_ENDPOINT: 'http://127.0.0.1:1',
      });
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/\[fetch-backup\] FAILED/);
    });

    it.each([
      'BACKUP_S3_ENDPOINT',
      'BACKUP_S3_BUCKET',
      'BACKUP_S3_ACCESS_KEY_ID',
      'BACKUP_S3_SECRET_ACCESS_KEY',
    ])('не задана %s → FAILED с именем переменной', async (name) => {
      const res = await run([out], { [name]: '' });
      expect(res.code).not.toBe(0);
      expect(res.stderr).toContain(`не задана переменная ${name}`);
      expect(s3.requests).toHaveLength(0);
    });

    it('без каталога → FAILED', async () => {
      const res = await run([]);
      expect(res.code).not.toBe(0);
      expect(res.stderr).toContain('не указан каталог');
    });
  });

  it('секрет хранилища не попадает в командную строку curl и в вывод', async () => {
    backup('2026-10-09');
    const res = await run();
    const log = readFileSync(curlLog, 'utf8');
    expect(log).toContain('list-type=2'); // обёртка действительно видела вызовы
    expect(log).not.toContain(FAKE_S3_SECRET);
    expect(res.stdout + res.stderr).not.toContain(FAKE_S3_SECRET);
  });

  it('вывод — только имя, дата, размер и числа: содержимого файла в нём нет', async () => {
    backup('2026-10-09', 'СОДЕРЖИМОЕ-ДАМПА-НЕ-ДЛЯ-ЛОГОВ');
    const res = await run();
    expect(res.stdout + res.stderr).not.toContain('СОДЕРЖИМОЕ-ДАМПА');
  });
});

describe('scripts/s3-api.sh — единственное место входа в хранилище', () => {
  it('s3_curl и s3_list определены только в нём, а backup-upload.sh и backup-fetch-latest.sh его подключают', () => {
    const api = readFileSync(S3_API, 'utf8');
    expect(api).toMatch(/^s3_curl\(\) \{/m);
    expect(api).toMatch(/^s3_list\(\) \{/m);
    for (const script of [BACKUP, FETCH]) {
      const text = readFileSync(script, 'utf8');
      expect(text).toMatch(/^source "\$HERE\/s3-api\.sh"$/m);
      expect(text).not.toMatch(/^s3_(curl|list)\(\) \{/m);
      expect(text).not.toContain('--aws-sigv4');
    }
  });

  // Правило №23: shell-разбор ListObjectsV2 проверяется на ответах из
  // документации AWS — тех же, что и разбор в src/infra/s3-list-objects.ts.
  const parse = (xml: string) =>
    spawnSync('bash', ['-c', `source '${S3_API}'; node -e "$S3_LIST_JS"`], {
      input: xml,
      encoding: 'utf8',
    });

  it('разбирает s3-list-objects-v2-truncated.xml: курсор закодирован для адреса, файл с размером и ETag без кавычек', () => {
    const res = parse(loadRecordedFixture('s3-list-objects-v2-truncated.xml'));
    expect(res.status).toBe(0);
    expect(res.stdout.split('\n').filter(Boolean)).toEqual([
      '1ueGcxLPRx1Tr%2FXYExHnhbYLgveDs2J%2Fwm36Hy4vbOwM%3D',
      'happyface.jpg\t11\t70ee1738b6b21e2c8a43f3a5ab0eee71',
    ]);
  });

  it('разбирает s3-list-objects-v2-prefix.xml: последняя страница — курсор пустой', () => {
    const res = parse(loadRecordedFixture('s3-list-objects-v2-prefix.xml'));
    expect(res.status).toBe(0);
    expect(res.stdout.split('\n')).toEqual([
      '',
      'ExampleObject.txt\t857\t599bab3ed2c697f1d26842727561fd94',
      '',
    ]);
  });

  it('не список (ошибка S3 в XML) → код ≠ 0, а не пустой «бакет»', () => {
    expect(parse('<Error><Code>AccessDenied</Code></Error>').status).not.toBe(
      0,
    );
  });
});
