import { describe, it, expect, vi } from 'vitest';
import { buildSharedApi, type ApiTransport } from './sharedApi';

const transport = (post: ApiTransport['post']): ApiTransport =>
  ({ post }) as unknown as ApiTransport;

describe('trackPublicEvent', () => {
  it('без опций — прежний вызов транспорта, с keepalive — опция доходит до него', () => {
    const post = vi.fn(() => Promise.resolve());
    const track = buildSharedApi(transport(post)).trackPublicEvent;

    track('practice_link_click', { place: 'faq' });
    track('links_page_click', { target: 'booking' }, { keepalive: true });

    expect(post.mock.calls).toEqual([
      [
        '/api/public-event',
        { name: 'practice_link_click', meta: { place: 'faq' } },
      ],
      [
        '/api/public-event',
        { name: 'links_page_click', meta: { target: 'booking' } },
        { keepalive: true },
      ],
    ]);
  });

  it('сбой транспорта не пробрасывается', () => {
    const bad = transport(() => Promise.reject(new Error('x')));
    const track = buildSharedApi(bad).trackPublicEvent;
    expect(() => track('crisis_card_shown')).not.toThrow();
  });
});
