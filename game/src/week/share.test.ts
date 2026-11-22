import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shareWeek, SHARE_URL } from './share';

const sent: { name: string; meta: unknown }[] = [];
beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => { sent.push(JSON.parse(init.body)); return Promise.resolve(); });
});

describe('«поделиться» после хука', () => {
  it('есть системное окно — зовёт его с текстом и ссылкой с меткой', () => {
    const share = vi.fn(() => Promise.resolve()), open = vi.fn();
    shareWeek('Неделя Саши', { share }, open);
    expect(share).toHaveBeenCalledWith({ text: 'Неделя Саши', url: SHARE_URL });
    expect(open).not.toHaveBeenCalled();
    expect(sent).toEqual([{ name: 'game_share', meta: { from: 'hook' } }]);
  });

  it('системного окна нет — открывает окно Telegram', () => {
    const open = vi.fn();
    shareWeek('Неделя Саши', {}, open);
    expect(open).toHaveBeenCalledWith(expect.stringContaining('https://t.me/share/url?url=' + encodeURIComponent(SHARE_URL)));
    expect(open.mock.calls[0][0]).toContain(encodeURIComponent('Неделя Саши'));
  });

  it('отказ в системном окне игру не роняет', () => {
    expect(() => shareWeek('x', { share: () => Promise.reject(new Error('cancel')) }, vi.fn())).not.toThrow();
  });
});
