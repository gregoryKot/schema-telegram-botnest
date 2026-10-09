// Поддельный B2 (fake-b2.ts) сам под тестом: загрузку и удаление версий в
// юнит-прогоне никто не дёргает — их зовёт только e2e восстановления
// (test/restore-b2.e2e-spec.ts, джоба migrations) через настоящий
// backup-to-b2.sh. Если подделка разойдётся с тем, что ждёт скрипт, e2e
// покажет падение скрипта, а не подделки; этот спек отвечает за неё саму.
import { createHash } from 'crypto';
import { FakeB2, FAKE_B2_BUCKET, FAKE_B2_TOKEN } from './fake-b2';

describe('FakeB2', () => {
  let b2: FakeB2;
  const api = (method: string, body: unknown = {}) =>
    fetch(`${b2.url}/b2api/v3/${method}`, {
      method: 'POST',
      headers: { Authorization: FAKE_B2_TOKEN },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    b2 = await new FakeB2().start();
  });
  afterEach(() => b2.stop());

  it('бакет находится по имени из запроса', async () => {
    const res = await api('b2_list_buckets', { bucketName: FAKE_B2_BUCKET });
    const json = (await res.json()) as {
      buckets: { bucketName: string }[];
    };
    expect(json.buckets[0].bucketName).toBe(FAKE_B2_BUCKET);
  });

  it('загрузка заменяет файл с тем же именем и отдаёт его sha1', async () => {
    b2.add('a.enc', 'old');
    const target = (await (await api('b2_get_upload_url')).json()) as {
      uploadUrl: string;
    };
    const up = await fetch(target.uploadUrl, {
      method: 'POST',
      headers: { 'X-Bz-File-Name': encodeURIComponent('a.enc') },
      body: 'new',
    });
    const meta = (await up.json()) as { contentSha1: string };
    expect(meta.contentSha1).toBe(
      createHash('sha1').update('new').digest('hex'),
    );
    expect(b2.files.map((f) => f.content.toString())).toEqual(['new']);
  });

  it('список версий отсортирован, удаление убирает версию по id', async () => {
    b2.add('b.enc', '2');
    b2.add('a.enc', '1');
    const list = (await (await api('b2_list_file_versions')).json()) as {
      files: { fileName: string; fileId: string }[];
    };
    expect(list.files.map((f) => f.fileName)).toEqual(['a.enc', 'b.enc']);
    await api('b2_delete_file_version', { fileId: list.files[0].fileId });
    expect(b2.files.map((f) => f.fileName)).toEqual(['b.enc']);
  });

  it('скачивание из чужого бакета и неизвестный путь — 404', async () => {
    b2.add('a.enc', '1');
    const wrongBucket = await fetch(`${b2.url}/file/other/a.enc`, {
      headers: { Authorization: FAKE_B2_TOKEN },
    });
    expect(wrongBucket.status).toBe(404);
    expect((await api('b2_unknown')).status).toBe(404);
  });
});
