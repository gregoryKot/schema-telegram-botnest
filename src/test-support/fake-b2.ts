// Поддельный Backblaze B2 для спеков скриптов бэкапа: локальный HTTP-сервер по
// контракту родного API v3 (authorize → list_buckets → get_upload_url → upload,
// list_file_names, list_file_versions, delete_file_version, скачивание по имени).
// Используют src/infra/fetch-latest-b2.spec.ts и сквозной test/restore-b2.e2e-spec.ts:
// второй гоняет настоящий backup-to-b2.sh → этот сервер → fetch-latest-b2.sh →
// restore-backup.sh на живом Postgres.
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { createHash } from 'crypto';

export const FAKE_B2_KEY_ID = 'keyid123';
export const FAKE_B2_APP_KEY = 'APPKEY-super-secret-value';
export const FAKE_B2_TOKEN = 'AUTH-TOKEN-xyz';
export const FAKE_B2_BUCKET = 'my-bucket';

export interface FakeB2File {
  fileName: string;
  fileId: string;
  content: Buffer;
}

export interface FakeB2Request {
  path: string;
  headers: IncomingMessage['headers'];
  body: Buffer;
}

export class FakeB2 {
  server!: Server;
  url = '';
  files: FakeB2File[] = [];
  requests: FakeB2Request[] = [];
  /** Сколько имён отдаёт одна страница list_file_names. */
  pageSize = 1000;
  authStatus = 200;
  /** Скачивание без права readFiles: B2 отвечает 401. */
  denyDownload = false;
  /** Имена, которые скачиваются с испорченным содержимым той же длины. */
  corrupt = new Set<string>();
  /** Имена, которые скачиваются обрезанными. */
  truncate = new Set<string>();

  add(fileName: string, content: Buffer | string): void {
    this.files.push({
      fileName,
      fileId: `id-${this.files.length}-${fileName}`,
      content: Buffer.isBuffer(content) ? content : Buffer.from(content),
    });
  }

  get authUrl(): string {
    return `${this.url}/b2api/v3/b2_authorize_account`;
  }

  private sorted(): FakeB2File[] {
    return [...this.files].sort((a, b) => (a.fileName < b.fileName ? -1 : 1));
  }

  private describe(f: FakeB2File) {
    return {
      fileName: f.fileName,
      fileId: f.fileId,
      action: 'upload',
      contentLength: f.content.length,
      contentSha1: createHash('sha1').update(f.content).digest('hex'),
    };
  }

  private handle(
    req: IncomingMessage,
    res: ServerResponse,
    body: Buffer,
  ): void {
    const path = req.url ?? '';
    const json = (payload: unknown, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    const payload = () => JSON.parse(body.toString() || '{}');
    this.requests.push({ path, headers: req.headers, body });

    if (path.endsWith('/b2_authorize_account')) {
      const basic = Buffer.from(
        `${FAKE_B2_KEY_ID}:${FAKE_B2_APP_KEY}`,
      ).toString('base64');
      if (
        this.authStatus !== 200 ||
        req.headers.authorization !== `Basic ${basic}`
      ) {
        return json({ code: 'unauthorized', message: 'bad key' }, 401);
      }
      return json({
        accountId: 'acc1',
        authorizationToken: FAKE_B2_TOKEN,
        apiInfo: { storageApi: { apiUrl: this.url, downloadUrl: this.url } },
      });
    }
    if (path.endsWith('/b2_list_buckets')) {
      return json({
        buckets: [{ bucketId: 'bkt-id-1', bucketName: payload().bucketName }],
      });
    }
    if (path.endsWith('/b2_get_upload_url')) {
      return json({
        uploadUrl: `${this.url}/upload-target`,
        authorizationToken: 'UPLOAD-TOKEN-abc',
      });
    }
    if (path === '/upload-target') {
      const fileName = decodeURIComponent(
        String(req.headers['x-bz-file-name']),
      );
      this.files = this.files.filter((f) => f.fileName !== fileName);
      this.add(fileName, body);
      return json(this.describe(this.files[this.files.length - 1]));
    }
    if (path.endsWith('/b2_list_file_names')) {
      const p = payload();
      const rows = this.sorted().filter(
        (f) =>
          f.fileName.startsWith(p.prefix ?? '') &&
          f.fileName >= (p.startFileName ?? ''),
      );
      const page = rows.slice(
        0,
        Math.min(this.pageSize, p.maxFileCount ?? 100),
      );
      return json({
        files: page.map((f) => this.describe(f)),
        nextFileName:
          rows.length > page.length ? rows[page.length].fileName : null,
      });
    }
    if (path.endsWith('/b2_list_file_versions')) {
      return json({
        files: this.sorted().map((f) => this.describe(f)),
        nextFileName: null,
        nextFileId: null,
      });
    }
    if (path.endsWith('/b2_delete_file_version')) {
      this.files = this.files.filter((f) => f.fileId !== payload().fileId);
      return json({});
    }
    const download = /^\/file\/([^/]+)\/(.+)$/.exec(path);
    if (download) {
      if (this.denyDownload || req.headers.authorization !== FAKE_B2_TOKEN) {
        return json({ code: 'unauthorized', message: 'no readFiles' }, 401);
      }
      const name = decodeURIComponent(download[2]);
      const file = this.files.find((f) => f.fileName === name);
      if (download[1] !== FAKE_B2_BUCKET || !file) {
        return json({ code: 'not_found' }, 404);
      }
      let content = file.content;
      if (this.corrupt.has(name)) {
        content = Buffer.from(content);
        content[content.length - 1] ^= 0xff;
      }
      if (this.truncate.has(name)) content = content.subarray(0, -1);
      res.writeHead(200, { 'Content-Length': content.length });
      return void res.end(content);
    }
    return json({ code: 'not_found' }, 404);
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
