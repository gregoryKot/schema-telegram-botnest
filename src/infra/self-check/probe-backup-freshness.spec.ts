// Проба свежести бэкапов в R2 (аудит D-2). Ходит настоящим fetch в поддельный
// S3 (src/test-support/fake-s3.ts), который сверяет подпись SigV4 и отдаёт
// ListObjectsV2 постранично, — как хранилище.
import { backupFreshnessProbe } from './probe-backup-freshness';
import { FAKE_S3_SECRET, FakeS3 } from '../../test-support/fake-s3';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const H = 3_600_000;
const KEY = 'x'.repeat(40);

const name = (date: string) => `schemehappens-${date}.sql.gz.enc`;

describe('backupFreshnessProbe', () => {
  let s3: FakeS3;
  beforeEach(async () => {
    s3 = await new FakeS3().start();
  });
  afterEach(() => s3.stop());

  const env = (extra: Record<string, string> = {}) => ({
    ...s3.env(),
    BACKUP_ENCRYPTION_KEY: KEY,
    ...extra,
  });
  const run = (
    e: Record<string, string | undefined> = env(),
    uptime = 99_999,
  ) =>
    backupFreshnessProbe(e, { now: () => NOW, uptimeSec: () => uptime }).run();
  const add = (date: string, ageH?: number) =>
    s3.add(
      name(date),
      'x',
      ageH === undefined ? new Date(NOW) : new Date(NOW - ageH * H),
    );

  it('бэкапы не настроены — выключено, в сеть не ходит', async () => {
    expect(await run({})).toEqual({ ok: true, detail: 'выключено' });
    expect(s3.requests).toHaveLength(0);
  });

  it('настроено не до конца — авария с именами недостающих переменных', async () => {
    const res = await run({
      BACKUP_S3_BUCKET: 'b',
      BACKUP_S3_ENDPOINT: s3.url,
    });
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('BACKUP_S3_ACCESS_KEY_ID');
    expect(res.detail).toContain('BACKUP_ENCRYPTION_KEY');
    expect(s3.requests).toHaveLength(0);
  });

  it('свежий бэкап (20 ч) — ok, «последний бэкап DD.MM, N ч назад»; запрос подписан и с префиксом', async () => {
    add('2026-10-03', 20);
    expect(await run()).toEqual({
      ok: true,
      detail: 'последний бэкап 03.10, 20 ч назад',
    });
    expect(s3.requests[0].query.get('prefix')).toBe('schemehappens-');
    expect(s3.requests[0].headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 .*\/auto\/s3\/aws4_request/,
    );
  });

  it('берёт самый новый из нескольких, файлы .sha256 и чужие не считает', async () => {
    add('2026-09-30', 100);
    add('2026-10-04', 2);
    s3.add(`${name('2026-10-04')}.sha256`, 'x', new Date(NOW));
    expect((await run()).detail).toBe('последний бэкап 04.10, 2 ч назад');
  });

  it('старше 36 ч — ok:false с человеческим detail', async () => {
    add('2026-10-02', 40);
    expect(await run()).toEqual({
      ok: false,
      detail: 'последний бэкап 02.10, 40 ч назад (норма — не старше 36 ч)',
    });
  });

  it('граница: ровно 36 ч — уже авария, 35 ч — ещё норма', async () => {
    add('2026-10-03', 36);
    expect((await run()).ok).toBe(false);
    s3.objects.clear();
    s3.add(name('2026-10-03'), 'x', new Date(NOW - 35 * H - 1000));
    expect((await run()).ok).toBe(true);
  });

  it('бакет пуст — «бэкапов в бакете нет»', async () => {
    expect(await run()).toEqual({ ok: false, detail: 'бэкапов в бакете нет' });
  });

  it('бакет пуст, но сервис запущен минуту назад — ждём первый бэкап, не тревожим', async () => {
    const res = await run(env(), 60);
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('ждём первый бэкап');
  });

  it('читает все страницы листинга: свежий файл на последней странице находится', async () => {
    s3.pageSize = 1;
    add('2026-09-01', 900);
    add('2026-09-02', 800);
    add('2026-10-04', 1);
    expect((await run()).ok).toBe(true);
    expect(s3.requests).toHaveLength(3);
  });

  it('ключ отклонён — ok:false с кодом ошибки, секрета в detail нет', async () => {
    s3.rejectKey = true;
    const res = await run();
    expect(res.ok).toBe(false);
    expect(res.detail).toBe(
      'не удалось проверить бэкапы: S3 ответил HTTP 403: InvalidAccessKeyId',
    );
    expect(res.detail).not.toContain(FAKE_S3_SECRET);
  });

  it('BACKUP_S3_REGION уходит в подпись', async () => {
    add('2026-10-04', 1);
    await run(env({ BACKUP_S3_REGION: 'eu-west-1' }));
    expect(s3.requests[0].headers.authorization).toContain(
      '/eu-west-1/s3/aws4_request',
    );
  });

  it('сеть упала — ok:false, не бросает', async () => {
    const res = await backupFreshnessProbe(env(), {
      fetchFn: (async () => {
        throw new Error('ECONNRESET');
      }) as unknown as typeof fetch,
    }).run();
    expect(res).toEqual({
      ok: false,
      detail: 'не удалось проверить бэкапы: ECONNRESET',
    });
  });

  it('нет LastModified в ответе — возраст по дате из имени (полночь UTC)', async () => {
    const xml =
      '<ListBucketResult><IsTruncated>false</IsTruncated><Contents>' +
      `<Key>${name('2026-10-04')}</Key><Size>1</Size></Contents></ListBucketResult>`;
    const res = await backupFreshnessProbe(env(), {
      now: () => NOW,
      fetchFn: (async () => new Response(xml)) as unknown as typeof fetch,
    }).run();
    expect(res).toEqual({
      ok: true,
      detail: 'последний бэкап 04.10, 12 ч назад',
    });
  });
});
