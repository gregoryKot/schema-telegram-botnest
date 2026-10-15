// Поддельное S3-совместимое хранилище (как Cloudflare R2) для спеков бэкапа:
// локальный HTTP-сервер, path-style адреса `/<бакет>/<ключ>`, операции
// PutObject, GetObject, DeleteObject и ListObjectsV2 с постраничной выдачей.
//
// Подпись SigV4 сервер НЕ принимает на веру: пересчитывает её модулем
// src/infra/s3-sigv4.ts (сверен с тест-векторами AWS) по тем заголовкам,
// которые подписал клиент, и отвечает 403 SignatureDoesNotMatch при
// расхождении. Так спек скрипта доказывает, что встроенная в curl подпись
// (`--aws-sigv4`) и подпись пробы самопроверки — одна и та же подпись.
// Как настоящий S3, требует `x-amz-content-sha256` и сверяет его с телом.
//
// Используют: src/infra/backup-upload.spec.ts, backup-fetch-latest.spec.ts,
// self-check/probe-backup-freshness.spec.ts и сквозной
// test/restore-backup.e2e-spec.ts (джоба migrations).
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { createHash } from 'crypto';
import { computeSignature, sha256Hex } from '../infra/s3-sigv4';

export const FAKE_S3_ACCESS_KEY_ID = 'fakeaccesskeyid0123456789abcdef0';
export const FAKE_S3_SECRET = 'FAKE-secret-access-key-super-value';
export const FAKE_S3_BUCKET = 'my-bucket';
/** Курсор с `/`, `+`, `=` — клиент обязан кодировать его в адресе строго. */
const TOKEN_MARK = 'tok/+=';

export interface FakeS3Object {
  key: string;
  content: Buffer;
  lastModified: Date;
}

export interface FakeS3Request {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingMessage['headers'];
  body: Buffer;
}

const md5 = (b: Buffer) => createHash('md5').update(b).digest('hex');
const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export class FakeS3 {
  server!: Server;
  url = '';
  objects = new Map<string, FakeS3Object>();
  requests: FakeS3Request[] = [];
  /** Сколько ключей отдаёт одна страница ListObjectsV2. */
  pageSize = 1000;
  /** Не тот ключ доступа: всё отвечает 403 InvalidAccessKeyId. */
  rejectKey = false;
  /** Токен без права чтения: GetObject → 403 AccessDenied. */
  denyRead = false;
  /** Список файлов падает 500. */
  failList = false;
  /** PutObject отвечает ETag, не совпадающим с MD5 тела. */
  wrongEtag = false;
  /** Ключи, которые скачиваются испорченными (та же длина) или обрезанными. */
  corrupt = new Set<string>();
  truncate = new Set<string>();

  add(key: string, content: Buffer | string, lastModified = new Date()): void {
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);
    this.objects.set(key, { key, content: buf, lastModified });
  }

  /** Переменные окружения бэкапа, указывающие на этот сервер. */
  env(): Record<string, string> {
    return {
      BACKUP_S3_ENDPOINT: this.url,
      BACKUP_S3_BUCKET: FAKE_S3_BUCKET,
      BACKUP_S3_ACCESS_KEY_ID: FAKE_S3_ACCESS_KEY_ID,
      BACKUP_S3_SECRET_ACCESS_KEY: FAKE_S3_SECRET,
    };
  }

  /** null — подпись верна; иначе код ошибки S3. */
  private checkAuth(
    req: IncomingMessage,
    path: string,
    query: string,
    body: Buffer,
  ): string | null {
    const m =
      /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/s3\/aws4_request, ?SignedHeaders=([a-z0-9;-]+), ?Signature=([0-9a-f]{64})$/.exec(
        req.headers.authorization ?? '',
      );
    if (!m) return 'AccessDenied';
    if (this.rejectKey || m[1] !== FAKE_S3_ACCESS_KEY_ID)
      return 'InvalidAccessKeyId';
    const payloadHash = String(req.headers['x-amz-content-sha256'] ?? '');
    if (!payloadHash) return 'MissingContentSHA256';
    if (payloadHash !== 'UNSIGNED-PAYLOAD' && payloadHash !== sha256Hex(body)) {
      return 'XAmzContentSHA256Mismatch';
    }
    const headers = Object.fromEntries(
      m[4].split(';').map((h) => [h, String(req.headers[h] ?? '')]),
    );
    const { signature } = computeSignature({
      method: req.method ?? 'GET',
      path,
      query,
      headers,
      payloadHash,
      amzDate: String(req.headers['x-amz-date'] ?? ''),
      region: m[3],
      service: 's3',
      secretAccessKey: FAKE_S3_SECRET,
    });
    return signature === m[5] ? null : 'SignatureDoesNotMatch';
  }

  private list(q: URLSearchParams): string {
    const prefix = q.get('prefix') ?? '';
    const token = q.get('continuation-token');
    const after = token?.startsWith(TOKEN_MARK)
      ? Buffer.from(token.slice(TOKEN_MARK.length), 'base64').toString()
      : '';
    const rows = [...this.objects.values()]
      .filter((o) => o.key.startsWith(prefix) && o.key > after)
      .sort((a, b) => (a.key < b.key ? -1 : 1));
    const max = Math.min(this.pageSize, Number(q.get('max-keys') ?? 1000));
    const page = rows.slice(0, max);
    const truncated = rows.length > page.length;
    const next = truncated
      ? `<NextContinuationToken>${TOKEN_MARK}${Buffer.from(page[page.length - 1].key).toString('base64')}</NextContinuationToken>`
      : '';
    const contents = page
      .map(
        (o) =>
          `<Contents><Key>${xmlEscape(o.key)}</Key><LastModified>${o.lastModified.toISOString()}</LastModified>` +
          `<ETag>&quot;${md5(o.content)}&quot;</ETag><Size>${o.content.length}</Size><StorageClass>STANDARD</StorageClass></Contents>`,
      )
      .join('');
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">` +
      `<Name>${FAKE_S3_BUCKET}</Name><Prefix>${xmlEscape(prefix)}</Prefix>${next}<KeyCount>${page.length}</KeyCount>` +
      `<MaxKeys>${max}</MaxKeys><IsTruncated>${truncated}</IsTruncated>${contents}</ListBucketResult>`
    );
  }

  private handle(
    req: IncomingMessage,
    res: ServerResponse,
    body: Buffer,
  ): void {
    const url = new URL(req.url ?? '/', 'http://fake');
    const method = req.method ?? 'GET';
    this.requests.push({
      method,
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers,
      body,
    });
    const send = (
      status: number,
      payload: string | Buffer = '',
      headers: Record<string, string> = {},
    ) => {
      res.writeHead(status, headers);
      res.end(payload);
    };
    const error = (status: number, code: string) =>
      send(
        status,
        `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>fake</Message></Error>`,
        {
          'Content-Type': 'application/xml',
        },
      );

    const authError = this.checkAuth(req, url.pathname, url.search, body);
    if (authError)
      return error(
        authError === 'XAmzContentSHA256Mismatch' ? 400 : 403,
        authError,
      );
    const [, bucket, ...rest] = url.pathname.split('/');
    const key = decodeURIComponent(rest.join('/'));
    if (bucket !== FAKE_S3_BUCKET) return error(404, 'NoSuchBucket');

    if (!key && method === 'GET' && url.searchParams.get('list-type') === '2') {
      if (this.failList) return error(500, 'InternalError');
      return send(200, this.list(url.searchParams), {
        'Content-Type': 'application/xml',
      });
    }
    if (key && method === 'PUT') {
      this.add(key, body);
      return send(200, '', {
        ETag: `"${this.wrongEtag ? 'f'.repeat(32) : md5(body)}"`,
      });
    }
    if (key && method === 'DELETE') {
      this.objects.delete(key);
      return send(204);
    }
    if (key && method === 'GET') {
      if (this.denyRead) return error(403, 'AccessDenied');
      const obj = this.objects.get(key);
      if (!obj) return error(404, 'NoSuchKey');
      let content = obj.content;
      if (this.corrupt.has(key)) {
        content = Buffer.from(content);
        content[content.length - 1] ^= 0xff;
      }
      if (this.truncate.has(key)) content = content.subarray(0, -1);
      return send(200, content, {
        ETag: `"${md5(obj.content)}"`,
        'Content-Length': String(content.length),
      });
    }
    return error(405, 'MethodNotAllowed');
  }

  async start(): Promise<this> {
    this.server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => this.handle(req, res, Buffer.concat(chunks)));
    });
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }

  stop(): Promise<void> {
    return new Promise((r) => this.server.close(() => r()));
  }
}
