// @vitest-environment jsdom
// Телеметрия крашей: единственная копия для обоих фронтендов. Контракт:
// шлёт усечённый payload с source и санитизированным url (H0: без
// query/fragment — там живут JWT и initData) и НИКОГДА не бросает.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClientErrorReporter } from './clientErrorReport';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true });
});
afterEach(() => vi.unstubAllGlobals());

function sentBody(): Record<string, unknown> {
  return JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
}

describe('createClientErrorReporter', () => {
  it('шлёт POST на /api/client-errors с source и keepalive', () => {
    createClientErrorReporter(
      'https://x',
      'webapp',
    )({ message: 'boom', section: 'today' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://x/api/client-errors');
    expect(init.keepalive).toBe(true);
    expect(sentBody().source).toBe('webapp');
    expect(sentBody().section).toBe('today');
  });

  it('усечение: message 500, section 120, stack 4000', () => {
    createClientErrorReporter(
      '',
      'miniapp',
    )({
      message: 'm'.repeat(600),
      section: 's'.repeat(200),
      stack: 't'.repeat(5000),
    });
    const b = sentBody();
    expect((b.message as string).length).toBe(500);
    expect((b.section as string).length).toBe(120);
    expect((b.stack as string).length).toBe(4000);
    expect(b.source).toBe('miniapp');
  });

  it('H0: url — только путь, без query и fragment (там JWT/initData)', () => {
    window.history.replaceState(
      {},
      '',
      '/auth/callback?x=1#access_token=SECRET',
    );
    createClientErrorReporter('', 'webapp')({ message: 'm', section: 's' });
    const u = sentBody().url as string;
    expect(u).toContain('/auth/callback');
    expect(u).not.toContain('SECRET');
    expect(u).not.toContain('x=1');
  });

  it('никогда не бросает: реджект fetch проглатывается', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(() =>
      createClientErrorReporter('', 'webapp')({ message: 'm', section: 's' }),
    ).not.toThrow();
    await Promise.resolve();
  });

  it('никогда не бросает: синхронный throw fetch проглатывается', () => {
    fetchMock.mockImplementation(() => {
      throw new Error('csp blocked');
    });
    expect(() =>
      createClientErrorReporter('', 'miniapp')({ message: 'm', section: 's' }),
    ).not.toThrow();
  });
});
