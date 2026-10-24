// Поддельный S3 (fake-s3.ts) сам под тестом. Главное в нём — сверка подписи:
// если подделка начнёт принимать любую подпись, спеки скриптов перестанут
// доказывать, что curl и Node подписывают одинаково. Поэтому здесь оба исхода:
// верная подпись принимается, испорченная — 403.
import { createHash } from 'crypto';
import { sha256Hex, signRequest, uriEncode } from '../infra/s3-sigv4';
import { parseListObjectsV2 } from '../infra/s3-list-objects';
import {
  FAKE_S3_ACCESS_KEY_ID,
  FAKE_S3_BUCKET,
  FAKE_S3_SECRET,
  FakeS3,
} from './fake-s3';

const CREDS = {
  accessKeyId: FAKE_S3_ACCESS_KEY_ID,
  secretAccessKey: FAKE_S3_SECRET,
  region: 'auto',
};

describe('FakeS3', () => {
  let s3: FakeS3;
  const call = (
    method: string,
    tail: string,
    body = '',
    tweak: (h: Record<string, string>) => void = () => {},
  ) => {
    const url = new URL(`${s3.url}/${FAKE_S3_BUCKET}${tail}`);
    const headers = signRequest({
      method,
      url,
      credentials: CREDS,
      payloadHash: sha256Hex(body),
    });
    tweak(headers);
    return fetch(url, { method, headers, body: body || undefined });
  };

  beforeEach(async () => {
    s3 = await new FakeS3().start();
  });
  afterEach(() => s3.stop());

  it('PUT с верной подписью сохраняет файл и отдаёт ETag = MD5 тела', async () => {
    const res = await call('PUT', '/a.enc', 'new');
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe(
      `"${createHash('md5').update('new').digest('hex')}"`,
    );
    expect(s3.objects.get('a.enc')?.content.toString()).toBe('new');
  });

  it('испорченная подпись — 403 SignatureDoesNotMatch, файл не записан', async () => {
    const res = await call('PUT', '/a.enc', 'x', (h) => {
      h.authorization = h.authorization.replace(/.$/, (c) =>
        c === '0' ? '1' : '0',
      );
    });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('SignatureDoesNotMatch');
    expect(s3.objects.size).toBe(0);
  });

  it('чужой ключ доступа, нет x-amz-content-sha256, тело не совпало с хешем — отказ', async () => {
    s3.rejectKey = true;
    expect((await call('GET', '/a')).status).toBe(403);
    s3.rejectKey = false;
    const noSha = await call('GET', '/a', '', (h) => {
      delete h['x-amz-content-sha256'];
    });
    expect(await noSha.text()).toContain('MissingContentSHA256');
    const url = new URL(`${s3.url}/${FAKE_S3_BUCKET}/a`);
    const lying = await fetch(url, {
      method: 'PUT',
      headers: signRequest({
        method: 'PUT',
        url,
        credentials: CREDS,
        payloadHash: sha256Hex('a'),
      }),
      body: 'b',
    });
    expect(lying.status).toBe(400);
  });

  it('список: страницы с курсором, в курсоре /, + и = — клиент кодирует его строго', async () => {
    s3.pageSize = 2;
    for (const k of ['p-1', 'p-2', 'p-3', 'other']) s3.add(k, k);
    const first = parseListObjectsV2(
      await (await call('GET', '?list-type=2&prefix=p-')).text(),
    );
    expect(first.objects.map((o) => o.key)).toEqual(['p-1', 'p-2']);
    expect(first.nextToken).toMatch(/[/+=]/);
    const second = parseListObjectsV2(
      await (
        await call(
          'GET',
          `?continuation-token=${uriEncode(first.nextToken!)}&list-type=2&prefix=p-`,
        )
      ).text(),
    );
    expect(second.objects.map((o) => o.key)).toEqual(['p-3']);
    expect(second.nextToken).toBeNull();
  });

  it('скачивание: испорченное и обрезанное по заказу, чужой бакет и нет файла — 404', async () => {
    s3.add('a', 'abc');
    s3.corrupt.add('a');
    expect(await (await call('GET', '/a')).text()).not.toBe('abc');
    s3.corrupt.clear();
    s3.truncate.add('a');
    expect(await (await call('GET', '/a')).text()).toBe('ab');
    expect((await call('GET', '/missing')).status).toBe(404);
    const url = new URL(`${s3.url}/other-bucket/a`);
    const res = await fetch(url, {
      headers: signRequest({ method: 'GET', url, credentials: CREDS }),
    });
    expect(res.status).toBe(404);
  });

  it('DELETE убирает файл', async () => {
    s3.add('a', '1');
    expect((await call('DELETE', '/a')).status).toBe(204);
    expect(s3.objects.size).toBe(0);
  });
});
