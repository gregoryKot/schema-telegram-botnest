import { cachedUnlessEmpty } from './caldav-retry';

describe('cachedUnlessEmpty', () => {
  it('непустой результат кэшируется, пустой — нет', async () => {
    const load = jest
      .fn<Promise<string | null>, []>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('cal')
      .mockResolvedValue('other');
    const get = cachedUnlessEmpty(load, (v) => !v);
    expect(await get()).toBeNull();
    expect(await get()).toBe('cal');
    expect(await get()).toBe('cal');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
