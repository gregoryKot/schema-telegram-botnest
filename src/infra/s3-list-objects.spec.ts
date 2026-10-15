// Разбор ListObjectsV2 и постраничный обход (src/infra/s3-list-objects.ts).
// Разбор проверяется на ответах из документации AWS (правило №23:
// test/fixtures/recorded/s3-list-objects-v2-*.xml), обход — на поддельном S3,
// который сверяет подпись Node-стороны.
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import { FakeS3, FAKE_S3_BUCKET } from '../test-support/fake-s3';
import { backupS3Config } from './backup-config';
import { listObjects, listUrl, parseListObjectsV2 } from './s3-list-objects';

describe('parseListObjectsV2 — ответы из документации AWS', () => {
  it('s3-list-objects-v2-truncated.xml: обрезанная страница — курсор как есть, файл с размером, датой и ETag без кавычек', () => {
    const page = parseListObjectsV2(
      loadRecordedFixture('s3-list-objects-v2-truncated.xml'),
    );
    expect(page.nextToken).toBe(
      '1ueGcxLPRx1Tr/XYExHnhbYLgveDs2J/wm36Hy4vbOwM=',
    );
    expect(page.objects).toEqual([
      {
        key: 'happyface.jpg',
        size: 11,
        lastModified: '2014-11-21T19:40:05.000Z',
        etag: '70ee1738b6b21e2c8a43f3a5ab0eee71',
      },
    ]);
  });

  it('s3-list-objects-v2-prefix.xml: последняя страница (XML-пролог, StartAfter) — курсора нет', () => {
    const page = parseListObjectsV2(
      loadRecordedFixture('s3-list-objects-v2-prefix.xml'),
    );
    expect(page.nextToken).toBeNull();
    expect(page.objects.map((o) => [o.key, o.size, o.etag])).toEqual([
      ['ExampleObject.txt', 857, '599bab3ed2c697f1d26842727561fd94'],
    ]);
  });

  it('XML-сущности в ключе и ETag разворачиваются', () => {
    const page = parseListObjectsV2(
      '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>a&amp;b</Key>' +
        '<ETag>&quot;abc&quot;</ETag><Size>1</Size></Contents></ListBucketResult>',
    );
    expect(page.objects[0]).toMatchObject({ key: 'a&b', etag: 'abc' });
  });

  it('не список (ошибка S3) и обрезанный список без курсора — исключение, а не «пустой бакет»', () => {
    expect(() =>
      parseListObjectsV2('<Error><Code>AccessDenied</Code></Error>'),
    ).toThrow(/ListBucketResult/);
    expect(() =>
      parseListObjectsV2(
        '<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>',
      ),
    ).toThrow(/курсора/);
  });
});

describe('listObjects — поддельный S3', () => {
  let s3: FakeS3;
  beforeEach(async () => {
    s3 = await new FakeS3().start();
  });
  afterEach(() => s3.stop());

  it('обходит все страницы, подпись принята, берёт только префикс', async () => {
    s3.pageSize = 2;
    for (const k of ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'zzz']) s3.add(k, k);
    const all = await listObjects(backupS3Config(s3.env()), 'p-');
    expect(all.map((o) => o.key)).toEqual(['p-1', 'p-2', 'p-3', 'p-4', 'p-5']);
    expect(s3.requests).toHaveLength(3);
  });

  it('не дочитал за maxPages — исключение, а не обрезанный список', async () => {
    s3.pageSize = 1;
    for (const k of ['p-1', 'p-2', 'p-3']) s3.add(k, k);
    await expect(
      listObjects(backupS3Config(s3.env()), 'p-', { maxPages: 2 }),
    ).rejects.toThrow(/не дочитан/);
  });

  it('отказ хранилища — HTTP-код и код ошибки S3, без секрета', async () => {
    s3.rejectKey = true;
    const cfg = backupS3Config(s3.env());
    await expect(listObjects(cfg, 'p-')).rejects.toThrow(
      'S3 ответил HTTP 403: InvalidAccessKeyId',
    );
  });

  it('адрес: path-style, без двойного слеша, параметры в каноническом порядке', () => {
    const cfg = {
      ...backupS3Config(s3.env()),
      endpoint: 'https://acc.r2.cloudflarestorage.com/',
    };
    expect(listUrl(cfg, 'schemehappens-', 'a/b+c=').toString()).toBe(
      `https://acc.r2.cloudflarestorage.com/${FAKE_S3_BUCKET}?continuation-token=a%2Fb%2Bc%3D&list-type=2&prefix=schemehappens-`,
    );
  });
});
