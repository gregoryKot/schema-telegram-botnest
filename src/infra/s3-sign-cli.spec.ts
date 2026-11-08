// deploy/s3-sign.cjs как CLI — так его зовёт scripts/s3-api.sh: ключи на
// stdin, наружу — строки конфига curl (`-K -`). Сам алгоритм сверен с AWS и
// botocore в s3-sigv4.spec.ts; здесь — шов: что CLI отдаёт подпись того же
// алгоритма для того же адреса, не теряет `%2B` курсора и не светит секрет.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { EMPTY_SHA256, sha256Hex, signRequest } from './s3-sigv4';

const CLI = join(process.cwd(), 'deploy', 's3-sign.cjs');
const KEY_ID = 'AKIDEXAMPLE';
const SECRET = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';
const LIST_URL =
  'https://example.r2.cloudflarestorage.com/my-bucket?list-type=2&prefix=schemehappens-&continuation-token=1ue%2FX%2Bb%3D';

const sign = (args: string[], stdin = `${KEY_ID}\n${SECRET}\n`) =>
  spawnSync('node', [CLI, ...args], { input: stdin, encoding: 'utf8' });

/** `header = "имя: значение"` → { имя: значение } (кавычки curl-конфига сняты). */
const parseConfig = (out: string): Record<string, string> =>
  Object.fromEntries(
    out
      .trim()
      .split('\n')
      .map((line) => {
        const m = /^header = "(.*)"$/.exec(line);
        if (!m) throw new Error(`не строка конфига curl: ${line}`);
        const raw = m[1].replace(/\\(["\\])/g, '$1');
        const at = raw.indexOf(': ');
        return [raw.slice(0, at), raw.slice(at + 2)];
      }),
  );

describe('deploy/s3-sign.cjs — CLI для scripts/s3-api.sh', () => {
  it('листинг с курсором /, +, =: подпись та же, что у signRequest для этого адреса и времени', () => {
    const res = sign(['GET', LIST_URL, EMPTY_SHA256, 'auto']);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    const h = parseConfig(res.stdout);
    expect(Object.keys(h).sort()).toEqual([
      'authorization',
      'x-amz-content-sha256',
      'x-amz-date',
    ]);
    expect(h['x-amz-content-sha256']).toBe(EMPTY_SHA256);
    const date = h['x-amz-date'];
    expect(date).toMatch(/^\d{8}T\d{6}Z$/);
    const now = new Date(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`,
    );
    const credentials = {
      accessKeyId: KEY_ID,
      secretAccessKey: SECRET,
      region: 'auto',
    };
    const expected = signRequest({
      method: 'GET',
      url: new URL(LIST_URL),
      credentials,
      now,
    }).authorization;
    expect(h.authorization).toBe(expected);
    // Контроль: с курсором, где `+` стал `%20` (так подписывал curl 8.18), подпись другая.
    const asSpace = signRequest({
      method: 'GET',
      url: new URL(LIST_URL.replace('%2B', '%20')),
      credentials,
      now,
    }).authorization;
    expect(h.authorization).not.toBe(asSpace);
  });

  it('PUT: sha256 тела подписан и отдан заголовком', () => {
    const sha = sha256Hex('тело');
    const res = sign([
      'PUT',
      'http://127.0.0.1:9000/my-bucket/schemehappens-2026-11-08.sql.gz.enc',
      sha,
      'auto',
    ]);
    expect(res.status).toBe(0);
    const h = parseConfig(res.stdout);
    expect(h['x-amz-content-sha256']).toBe(sha);
    expect(h.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
  });

  // Что скрипты не кладут ключи в аргументы node, проверяют backup-*.spec.ts
  // обёрткой node в PATH.
  it('секрета нет в выводе', () => {
    const res = sign(['GET', LIST_URL, EMPTY_SHA256, 'auto']);
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain(SECRET);
  });

  it('кавычка и обратная косая черта в значении экранированы для конфига curl', () => {
    const res = sign(
      ['GET', LIST_URL, EMPTY_SHA256, 'auto'],
      `a"b\\c\n${SECRET}\n`,
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Credential=a\\"b\\\\c/');
    expect(parseConfig(res.stdout).authorization).toContain(
      'Credential=a"b\\c/',
    );
  });

  it.each([
    ['нет ключей в stdin', ['GET', LIST_URL, EMPTY_SHA256, 'auto'], ''],
    [
      'только ключ без секрета',
      ['GET', LIST_URL, EMPTY_SHA256, 'auto'],
      `${KEY_ID}\n`,
    ],
    [
      'sha256 не той формы',
      ['GET', LIST_URL, 'abc', 'auto'],
      `${KEY_ID}\n${SECRET}\n`,
    ],
    [
      'адрес не разобрать',
      ['GET', 'not a url', EMPTY_SHA256, 'auto'],
      `${KEY_ID}\n${SECRET}\n`,
    ],
    ['нет региона', ['GET', LIST_URL, EMPTY_SHA256], `${KEY_ID}\n${SECRET}\n`],
  ])(
    '%s → код 2, причина в stderr без секрета, stdout пуст',
    (_n, args, stdin) => {
      const res = sign(args, stdin);
      expect(res.status).toBe(2);
      expect(res.stdout).toBe('');
      expect(res.stderr).toMatch(/^s3-sign: /);
      expect(res.stderr).not.toContain(SECRET);
    },
  );
});
