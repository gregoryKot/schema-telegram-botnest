// Скачивание свежего бэкапа из B2 (scripts/fetch-latest-b2.sh + общий вход в B2
// scripts/b2-api.sh): первая половина аварийного восстановления из бэкапа
// (docs/MIGRATION_VPS.md, «План Б»). Скрипт гоняется по-настоящему против
// ПОДДЕЛЬНОГО B2 (src/test-support/fake-b2.ts). `curl` в PATH подменён обёрткой,
// пишущей аргументы в лог, — так доказывается, что ключ и токены не в командной
// строке. Сквозная связка с настоящими backup-to-b2.sh, restore-backup.sh и
// живым Postgres — test/restore-b2.e2e-spec.ts (джоба `migrations`).
import { spawn, spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  FAKE_B2_APP_KEY,
  FAKE_B2_BUCKET,
  FAKE_B2_KEY_ID,
  FAKE_B2_TOKEN,
  FakeB2,
} from '../test-support/fake-b2';

jest.setTimeout(60_000);

const FETCH = join(process.cwd(), 'scripts', 'fetch-latest-b2.sh');
const B2_API = join(process.cwd(), 'scripts', 'b2-api.sh');
const BACKUP = join(process.cwd(), 'scripts', 'backup-to-b2.sh');
const enc = (day: string) => `schemehappens-${day}.sql.gz.enc`;

describe('fetch-latest-b2.sh → B2 (поддельный сервер)', () => {
  let dir: string;
  let out: string;
  let fake: FakeB2;
  let curlLog: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'fetch-b2-'));
    out = join(dir, 'out');
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    curlLog = join(dir, 'curl.log');
    const realCurl = spawnSync('which', ['curl'], {
      encoding: 'utf8',
    }).stdout.trim();
    writeFileSync(
      join(bin, 'curl'),
      `#!/bin/bash\necho "curl $*" >> '${curlLog}'\nexec ${realCurl} "$@"\n`,
      { mode: 0o755 },
    );
    fake = await new FakeB2().start();
  });
  afterEach(async () => {
    await fake.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Кладёт в бакет пару «бэкап + контрольная сумма»; sha=false — без пары. */
  const backup = (day: string, body = `дамп ${day}`, sha = true) => {
    fake.add(enc(day), body);
    if (sha) fake.add(`${enc(day)}.sha256`, `sum-of-${day}  ${enc(day)}\n`);
  };

  function run(
    args: string[] = [out],
    extra: Record<string, string> = {},
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn('bash', [FETCH, ...args], {
        env: {
          ...process.env,
          PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
          B2_KEY_ID: FAKE_B2_KEY_ID,
          B2_APP_KEY: FAKE_B2_APP_KEY,
          B2_BUCKET: FAKE_B2_BUCKET,
          B2_AUTH_URL: fake.authUrl,
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
    });
  }

  it('берёт самый свежий по дате в имени (а не по порядку загрузки), качает его и .sha256', async () => {
    backup('2026-10-07');
    backup('2026-10-09', 'самый свежий дамп');
    backup('2026-10-08');

    const res = await run();

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
    // Печатает имя, размер и дату.
    const size = Buffer.byteLength('самый свежий дамп');
    expect(res.stdout.trim().split('\n').pop()).toBe(
      `[fetch-b2] ok ${enc('2026-10-09')} размер ${size} байт, дата 2026-10-09`,
    );
  });

  it('читает все страницы листинга: свежий файл на последней странице находится', async () => {
    fake.pageSize = 2;
    for (const d of ['01', '02', '03', '04', '05', '06'])
      backup(`2026-09-${d}`);
    backup('2026-10-01');

    const res = await run();

    expect(res.code).toBe(0);
    expect(res.stdout).toContain(`берём ${enc('2026-10-01')}`);
    expect(res.stdout).toContain('бэкапов в бакете: 7');
    const lists = fake.requests.filter((r) =>
      r.path.endsWith('/b2_list_file_names'),
    );
    expect(lists.length).toBeGreaterThan(3);
    expect(JSON.parse(lists[0].body.toString())).toMatchObject({
      prefix: 'schemehappens-',
    });
    expect(JSON.parse(lists[1].body.toString()).startFileName).toBeTruthy();
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
    fake.add('schemehappens-2099-01-01.sql.gz.enc.sha256', 'orphan');
    fake.add('schemehappens-notes.txt', 'x');
    fake.add('schemehappens-2098-01-01.sql.gz', 'plain');
    fake.add('other-2099-01-01.sql.gz.enc', 'x');

    const res = await run();

    expect(res.code).toBe(0);
    expect(res.stdout).toContain(`берём ${enc('2026-10-01')}`);
  });

  describe('отказы', () => {
    it('пустой бакет → FAILED «нет бэкапов», каталог пуст', async () => {
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/\[fetch-b2\] FAILED в бакете .* нет бэкапов/);
      expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
    });

    it('в бакете только файлы без пар .sha256 → FAILED', async () => {
      backup('2026-10-09', 'x', false);
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/ни у одного нет парного \.sha256/);
    });

    it('B2 не принял ключ (401) → FAILED, ключ в сообщении не светится', async () => {
      fake.authStatus = 401;
      backup('2026-10-09');
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(
        /\[fetch-b2\] FAILED B2: авторизация не удалась/,
      );
      expect(res.stdout + res.stderr).not.toContain(FAKE_B2_APP_KEY);
    });

    it('у ключа нет права readFiles (скачивание 401) → FAILED с подсказкой про readFiles', async () => {
      backup('2026-10-09');
      fake.denyDownload = true;
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(
        /скачивание .* не удалось \(у ключа есть право readFiles\?\)/,
      );
    });

    it('обрезанный при скачивании файл (размер) → FAILED', async () => {
      backup('2026-10-09', 'длинный дамп');
      fake.truncate.add(enc('2026-10-09'));
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/размер скачанного/);
    });

    it('файл, испорченный при скачивании (SHA1 от B2) → FAILED', async () => {
      backup('2026-10-09', 'длинный дамп');
      fake.corrupt.add(enc('2026-10-09'));
      const res = await run();
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/SHA1 скачанного/);
    });

    it('сервер B2 недоступен → FAILED, не зависание', async () => {
      const res = await run([out], {
        B2_AUTH_URL: 'http://127.0.0.1:1/b2_authorize_account',
      });
      expect(res.code).not.toBe(0);
      expect(res.stderr).toMatch(/\[fetch-b2\] FAILED/);
    });

    it.each(['B2_KEY_ID', 'B2_APP_KEY', 'B2_BUCKET'])(
      'не задана %s → FAILED с именем переменной',
      async (name) => {
        const res = await run([out], { [name]: '' });
        expect(res.code).not.toBe(0);
        expect(res.stderr).toContain(`не задана переменная ${name}`);
        expect(fake.requests).toHaveLength(0);
      },
    );

    it('без каталога → FAILED', async () => {
      const res = await run([]);
      expect(res.code).not.toBe(0);
      expect(res.stderr).toContain('не указан каталог');
    });
  });

  it('ключ приложения B2 и токены не попадают в командную строку curl и в вывод', async () => {
    backup('2026-10-09');
    const res = await run();
    const log = readFileSync(curlLog, 'utf8');
    expect(log).toContain('/b2_list_file_names'); // обёртка действительно видела вызовы
    for (const secret of [FAKE_B2_APP_KEY, FAKE_B2_TOKEN]) {
      expect(log).not.toContain(secret);
      expect(res.stdout + res.stderr).not.toContain(secret);
    }
  });

  it('вывод — только имя, дата, размер и числа: содержимого файла в нём нет', async () => {
    backup('2026-10-09', 'СОДЕРЖИМОЕ-ДАМПА-НЕ-ДЛЯ-ЛОГОВ');
    const res = await run();
    expect(res.stdout + res.stderr).not.toContain('СОДЕРЖИМОЕ-ДАМПА');
  });
});

describe('scripts/b2-api.sh — единственное место входа в B2', () => {
  it('b2_authorize и b2_post определены только в нём, а backup-to-b2.sh и fetch-latest-b2.sh его подключают', () => {
    const api = readFileSync(B2_API, 'utf8');
    expect(api).toMatch(/^b2_authorize\(\) \{/m);
    expect(api).toMatch(/^b2_post\(\) \{/m);
    for (const script of [BACKUP, FETCH]) {
      const text = readFileSync(script, 'utf8');
      expect(text).toMatch(/^source "\$HERE\/b2-api\.sh"$/m);
      expect(text).not.toMatch(/^b2_(authorize|post)\(\) \{/m);
    }
  });
});
