// Подпись SigV4 сверяется с ОПУБЛИКОВАННЫМИ AWS тест-векторами, а не с
// собственными ожиданиями: иначе тест сверял бы код с выдумкой того же автора
// (правило №23). Векторы — AWS Signature Version 4 Test Suite, перенесены без
// изменений в test/fixtures/recorded/aws-sigv4-test-suite.json (источник и
// способ получения — в соседнем .meta.json).
import { loadRecordedFixture } from '../test-support/recorded-fixture';
import {
  canonicalQuery,
  computeSignature,
  EMPTY_SHA256,
  sha256Hex,
  signRequest,
  toAmzDate,
  uriEncode,
} from './s3-sigv4';

interface Suite {
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    service: string;
    date: string;
  };
  cases: Array<{
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    authz: string;
  }>;
}
const SUITE = JSON.parse(
  loadRecordedFixture('aws-sigv4-test-suite.json'),
) as Suite;
const NOW = new Date(SUITE.credentials.date);

describe('SigV4 — тест-векторы AWS', () => {
  it('набор не пуст (фикстура прочитана)', () => {
    expect(SUITE.cases.length).toBeGreaterThanOrEqual(4);
  });

  it.each(SUITE.cases.map((c) => [c.name, c] as const))('%s', (_n, c) => {
    const headers = signRequest({
      method: c.method,
      url: new URL(c.url),
      credentials: SUITE.credentials,
      headers: c.headers,
      payloadHash: sha256Hex(c.body),
      service: SUITE.credentials.service,
      now: NOW,
    });
    expect(headers.authorization).toBe(c.authz);
  });
});

describe('SigV4 — детали', () => {
  it('для S3 добавляет x-amz-content-sha256 и подписывает его; host наружу не отдаёт', () => {
    const h = signRequest({
      method: 'GET',
      url: new URL('https://acc.r2.cloudflarestorage.com/bkt?list-type=2'),
      credentials: { ...SUITE.credentials, region: 'auto' },
      now: NOW,
    });
    expect(h['x-amz-content-sha256']).toBe(EMPTY_SHA256);
    expect(h['x-amz-date']).toBe('20150830T123600Z');
    expect(h.host).toBeUndefined();
    expect(h.authorization).toContain('/20150830/auto/s3/aws4_request');
    expect(h.authorization).toContain(
      'SignedHeaders=host;x-amz-content-sha256;x-amz-date',
    );
    expect(h.authorization).not.toContain(SUITE.credentials.secretAccessKey);
  });

  it('подпись зависит от секрета и от тела', () => {
    const base = {
      method: 'PUT',
      path: '/b/k',
      query: '',
      headers: { host: 'h', 'x-amz-date': '20150830T123600Z' },
      payloadHash: sha256Hex('a'),
      amzDate: '20150830T123600Z',
      region: 'auto',
      service: 's3',
      secretAccessKey: 's1',
    };
    const one = computeSignature(base).signature;
    expect(
      computeSignature({ ...base, secretAccessKey: 's2' }).signature,
    ).not.toBe(one);
    expect(
      computeSignature({ ...base, payloadHash: sha256Hex('b') }).signature,
    ).not.toBe(one);
  });

  it('канонический query: строгое кодирование токена продолжения (/, +, =)', () => {
    expect(
      canonicalQuery(
        `?prefix=schemehappens-&list-type=2&continuation-token=${uriEncode('1ue/X+b=')}`,
      ),
    ).toBe(
      'continuation-token=1ue%2FX%2Bb%3D&list-type=2&prefix=schemehappens-',
    );
    expect(uriEncode("a!'()*b")).toBe('a%21%27%28%29%2Ab');
  });

  it('toAmzDate отбрасывает миллисекунды и разделители', () => {
    expect(toAmzDate(new Date('2026-10-14T03:04:05.678Z'))).toBe(
      '20261014T030405Z',
    );
  });
});
