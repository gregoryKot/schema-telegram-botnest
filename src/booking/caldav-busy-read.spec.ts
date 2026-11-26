import { readBusy } from './caldav-busy-read';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('readBusy — классификация сбоя чтения календаря', () => {
  it('207 с телом — ok и разобранные интервалы', async () => {
    global.fetch = jest.fn(async () => ({
      status: 207,
      ok: false,
      text: async () =>
        'BEGIN:VEVENT\nDTSTART:20260913T100000Z\nDTEND:20260913T110000Z\nEND:VEVENT',
    })) as any;
    const r = await readBusy('https://x/', 'Basic a', '<q/>');
    expect(r.ok && r.intervals).toHaveLength(1);
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [500, 'http'],
  ])('статус %s → %s', async (status, kind) => {
    global.fetch = jest.fn(async () => ({ status, ok: false })) as any;
    const r = await readBusy('https://x/', 'Basic a', '<q/>');
    expect(r).toMatchObject({
      ok: false,
      kind,
      detail: `REPORT ${status} for https://x/`,
    });
  });

  it('таймаут → timeout, прочая сеть → network', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('The operation was aborted due to timeout');
    }) as any;
    expect(await readBusy('https://x/', 'a', 'q')).toMatchObject({
      kind: 'timeout',
    });
    global.fetch = jest.fn(async () => {
      throw new Error('fetch failed');
    }) as any;
    expect(await readBusy('https://x/', 'a', 'q')).toMatchObject({
      kind: 'network',
    });
  });
});
