// Проба свежести бэкапов в B2 (аудит D-2). Поддельный fetch отвечает так же,
// как родной API B2 v3: авторизация → (list_buckets) → list_file_names.
import { backupFreshnessProbe } from './probe-backup-freshness';

const ENV = {
  B2_KEY_ID: 'keyid',
  B2_APP_KEY: 'appkey-secret',
  B2_BUCKET: 'my-bucket',
  BACKUP_ENCRYPTION_KEY: 'x'.repeat(40),
};
const NOW = Date.parse('2026-10-04T12:00:00Z');
const H = 3_600_000;

interface Opts {
  files?: Array<{ fileName: string; uploadTimestamp?: number }>;
  pages?: Array<Array<{ fileName: string; uploadTimestamp?: number }>>;
  authStatus?: number;
  restrictedBucketId?: string;
}

function fakeFetch(opts: Opts = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const pages = opts.pages ?? [opts.files ?? []];
  let page = 0;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });
  const fn = jest.fn(async (url: string, init?: RequestInit) => {
    const u = url;
    calls.push({ url: u, init });
    if (u.endsWith('b2_authorize_account')) {
      if (opts.authStatus)
        return json({ message: 'bad credentials' }, opts.authStatus);
      return json({
        authorizationToken: 'tok',
        accountId: 'acc',
        apiInfo: {
          storageApi: {
            apiUrl: 'https://api001.example',
            bucketId: opts.restrictedBucketId,
          },
        },
      });
    }
    if (u.endsWith('b2_list_buckets')) {
      return json({
        buckets: [{ bucketId: 'bkt1', bucketName: 'my-bucket' }],
      });
    }
    if (u.endsWith('b2_list_file_names')) {
      const files = pages[page] ?? [];
      page += 1;
      return json({
        files,
        nextFileName: page < pages.length ? 'next' : null,
      });
    }
    return json({}, 404);
  });
  return { fn: fn as unknown as typeof fetch, calls, mock: fn };
}

const file = (date: string, ts?: number) => ({
  fileName: `schemehappens-${date}.sql.gz.enc`,
  uploadTimestamp: ts,
});

const run = (
  env: Record<string, string | undefined>,
  f: ReturnType<typeof fakeFetch>,
  uptime = 99_999,
) =>
  backupFreshnessProbe(env, {
    fetchFn: f.fn,
    now: () => NOW,
    uptimeSec: () => uptime,
  }).run();

describe('backupFreshnessProbe', () => {
  it('B2 не настроен — выключено, в сеть не ходит', async () => {
    const f = fakeFetch();
    expect(await run({}, f)).toEqual({ ok: true, detail: 'выключено' });
    expect(f.mock).not.toHaveBeenCalled();
  });

  it('настроено не до конца — авария с именами недостающих переменных', async () => {
    const f = fakeFetch();
    const res = await run({ B2_BUCKET: 'b', B2_KEY_ID: 'k' }, f);
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('B2_APP_KEY');
    expect(res.detail).toContain('BACKUP_ENCRYPTION_KEY');
    expect(f.mock).not.toHaveBeenCalled();
  });

  it('свежий бэкап (20 ч) — ok, «последний бэкап DD.MM, N ч назад»', async () => {
    const f = fakeFetch({ files: [file('2026-10-03', NOW - 20 * H)] });
    const res = await run(ENV, f);
    expect(res).toEqual({
      ok: true,
      detail: 'последний бэкап 03.10, 20 ч назад',
    });
  });

  it('берёт самый новый из нескольких, чужие файлы с префиксом (.sha256) не считает', async () => {
    const f = fakeFetch({
      files: [
        file('2026-09-30', NOW - 100 * H),
        file('2026-10-04', NOW - 2 * H),
        {
          fileName: 'schemehappens-2026-10-04.sql.gz.enc.sha256',
          uploadTimestamp: NOW,
        },
      ],
    });
    expect((await run(ENV, f)).detail).toBe('последний бэкап 04.10, 2 ч назад');
  });

  it('старше 36 ч — ok:false с человеческим detail', async () => {
    const f = fakeFetch({ files: [file('2026-10-02', NOW - 40 * H)] });
    const res = await run(ENV, f);
    expect(res.ok).toBe(false);
    expect(res.detail).toBe(
      'последний бэкап 02.10, 40 ч назад (норма — не старше 36 ч)',
    );
  });

  it('граница: ровно 36 ч — уже авария, 35 ч — ещё норма', async () => {
    expect(
      (await run(ENV, fakeFetch({ files: [file('2026-10-03', NOW - 36 * H)] })))
        .ok,
    ).toBe(false);
    expect(
      (
        await run(
          ENV,
          fakeFetch({ files: [file('2026-10-03', NOW - 35 * H - 1000)] }),
        )
      ).ok,
    ).toBe(true);
  });

  it('нет uploadTimestamp — возраст по дате из имени (полночь UTC)', async () => {
    const res = await run(ENV, fakeFetch({ files: [file('2026-10-04')] }));
    expect(res).toEqual({
      ok: true,
      detail: 'последний бэкап 04.10, 12 ч назад',
    });
  });

  it('бакет пуст — «бэкапов в бакете нет»', async () => {
    const res = await run(ENV, fakeFetch({ files: [] }));
    expect(res).toEqual({ ok: false, detail: 'бэкапов в бакете нет' });
  });

  it('бакет пуст, но сервис запущен минуту назад — ждём первый бэкап, не тревожим', async () => {
    const res = await run(ENV, fakeFetch({ files: [] }), 60);
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('ждём первый бэкап');
  });

  it('читает все страницы листинга: свежий файл на второй странице находится', async () => {
    const f = fakeFetch({
      pages: [
        [file('2026-09-01', NOW - 900 * H)],
        [file('2026-10-04', NOW - H)],
      ],
    });
    expect((await run(ENV, f)).ok).toBe(true);
  });

  it('ключ, ограниченный бакетом, — list_buckets не вызывается', async () => {
    const f = fakeFetch({
      restrictedBucketId: 'restricted',
      files: [file('2026-10-04', NOW - H)],
    });
    await run(ENV, f);
    expect(f.calls.some((c) => c.url.endsWith('b2_list_buckets'))).toBe(false);
    const list = f.calls.find((c) => c.url.endsWith('b2_list_file_names'))!;
    expect(JSON.parse(list.init?.body as string).bucketId).toBe('restricted');
  });

  it('авторизация отклонена — ok:false, секрета ключа в detail нет', async () => {
    const res = await run(ENV, fakeFetch({ authStatus: 401 }));
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('HTTP 401');
    expect(res.detail).not.toContain('appkey-secret');
  });

  it('сеть упала — ok:false, не бросает', async () => {
    const res = await backupFreshnessProbe(ENV, {
      fetchFn: (async () => {
        throw new Error('ECONNRESET');
      }) as unknown as typeof fetch,
    }).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('ECONNRESET');
  });

  it('логин и ключ уходят в Basic-заголовке авторизации, не в URL', async () => {
    const f = fakeFetch({ files: [file('2026-10-04', NOW - H)] });
    await run(ENV, f);
    const auth = f.calls[0];
    expect(auth.url).not.toContain('keyid');
    const header = (auth.init?.headers as Record<string, string>).Authorization;
    expect(Buffer.from(header.replace('Basic ', ''), 'base64').toString()).toBe(
      'keyid:appkey-secret',
    );
  });
});
