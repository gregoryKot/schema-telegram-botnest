// @vitest-environment jsdom
// Шов «клик → fetch»: кнопки /links открываются в той же вкладке, событие обязано
// уйти keepalive-запросом; остальные публичные события идут как прежде.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../../api';
import { trackLinksClick } from './trackLinksClick';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('') });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const sent = async (): Promise<[string, RequestInit]> => {
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
  return [String(url), init];
};

describe('trackLinksClick', () => {
  it('шлёт links_page_click на /api/public-event с keepalive: true', async () => {
    trackLinksClick('booking', '?utm_source=instagram');
    const [url, init] = await sent();
    expect(url).toContain('/api/public-event');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'links_page_click',
      meta: { target: 'booking', from: 'instagram' },
    });
  });

  it('публичное событие без опции уходит обычным запросом', async () => {
    api.trackPublicEvent('practice_link_click', { place: 'faq' });
    const [, init] = await sent();
    expect(init.keepalive).toBeUndefined();
  });
});
