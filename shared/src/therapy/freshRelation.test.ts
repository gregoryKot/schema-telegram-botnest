// QA 2026-11, М4: связь, появившаяся на другом устройстве, не видна в «Мой
// терапевт», пока жива запись кеша вкладки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cachedGet, clearApiCache } from '../api/apiCache';
import {
  loadFreshTherapyRelation,
  THERAPY_RELATION_PATH,
} from './freshRelation';

afterEach(() => clearApiCache());

describe('loadFreshTherapyRelation', () => {
  it('свежая запись кеша не мешает: связь читается с сервера', async () => {
    await cachedGet(THERAPY_RELATION_PATH, async () => null);
    const fromServer = { status: 'active', partnerName: 'Анна' };
    const fetcher = vi.fn(async () => fromServer);
    // Обычный GET отдал бы кеш (null), не дойдя до сети.
    expect(await cachedGet(THERAPY_RELATION_PATH, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    const fresh = await loadFreshTherapyRelation(() =>
      cachedGet(THERAPY_RELATION_PATH, fetcher),
    );
    expect(fresh).toEqual(fromServer);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
