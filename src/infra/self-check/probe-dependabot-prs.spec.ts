// Проба «бот-PR Dependabot старше 7 дней» (правило №21, аудит 2026-10,
// «Dependabot: доводка бот-PR»). Фикстура — настоящий ответ GitHub REST
// (test/fixtures/recorded/github-open-pulls.json, правило №23): 7 открытых PR,
// два от dependabot[bot] (#1032 от 2026-11-08T16:02:54Z, #1028 от
// 2026-11-08T15:37:00Z) и человеческие, среди них #631 от 2026-10-08.
import { dependabotPrsProbe } from './probe-dependabot-prs';
import { loadRecordedFixture } from '../../test-support/recorded-fixture';

const FIXTURE = 'github-open-pulls.json';
const DAY = 24 * 3_600_000;
const originalFetch = global.fetch;

const setNow = (iso: string, plusDays = 0) =>
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(iso) + plusDays * DAY);

function mockPulls(body: unknown = JSON.parse(loadRecordedFixture(FIXTURE))) {
  const fetchMock = jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => body });
  global.fetch = fetchMock as never;
  return fetchMock;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('dependabotPrsProbe', () => {
  it('reportInHealth: false и без повтора — не авария прода, лимит API без токена', () => {
    const probe = dependabotPrsProbe();
    expect(probe.reportInHealth).toBe(false);
    expect(probe.retryOnce).toBeFalsy();
  });

  it('свежие бот-PR (настоящий ответ, день записи) — ok, один запрос открытых PR', async () => {
    setNow('2026-11-08T20:00:00Z');
    const fetchMock = mockPulls();
    const res = await dependabotPrsProbe().run();
    expect(res).toEqual({
      ok: true,
      detail: 'открытых бот-PR Dependabot: 2, старше 7 дней нет',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(
      'https://api.github.com/repos/gregoryKot/schema-telegram-botnest/pulls?state=open&per_page=100',
    );
  });

  it('бот-PR старше 7 дней — красная, в detail номера и возраст, старший первым', async () => {
    setNow('2026-11-08T16:02:54Z', 9);
    mockPulls();
    const res = await dependabotPrsProbe().run();
    expect(res.ok).toBe(false);
    expect(res.detail).toBe(
      'бот-PR Dependabot старше 7 дней: #1028 (9 дн.), #1032 (9 дн.) — довести по процедуре docs/open/audit-2026-10.md',
    );
  });

  it('граница по старшему бот-PR (#1028): 6,99 дня — ещё ok, ровно 7 — красная', async () => {
    mockPulls();
    setNow('2026-11-08T15:37:00Z', 6.99);
    expect((await dependabotPrsProbe().run()).ok).toBe(true);
    jest.restoreAllMocks();
    mockPulls();
    setNow('2026-11-08T15:37:00Z', 7);
    const res = await dependabotPrsProbe().run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain(': #1028 (7 дн.) —');
  });

  it('контроль: старый PR человека (#631 от 2026-10-08) пробу не красит', async () => {
    setNow('2026-11-08T20:00:00Z');
    const fixture = JSON.parse(loadRecordedFixture(FIXTURE)) as {
      number: number;
    }[];
    expect(fixture.some((p) => p.number === 631)).toBe(true);
    mockPulls(fixture.filter((p) => p.number === 631));
    expect(await dependabotPrsProbe().run()).toEqual({
      ok: true,
      detail: 'открытых бот-PR Dependabot: 0, старше 7 дней нет',
    });
  });

  it.each([
    ['сеть', () => Promise.reject(new Error('fetch failed'))],
    [
      'таймаут',
      () =>
        Promise.reject(
          new DOMException('The operation was aborted', 'TimeoutError'),
        ),
    ],
    ['лимит API', () => Promise.resolve({ ok: false, status: 403 })],
  ])('%s — не красит: ok с пометкой «не проверено»', async (_n, impl) => {
    global.fetch = jest.fn().mockImplementation(impl) as never;
    const res = await dependabotPrsProbe().run();
    expect(res.ok).toBe(true);
    expect(res.detail).toMatch(/^GitHub не ответил, не проверено: /);
  });

  it('не массив в ответе — не бросает, бот-PR нет', async () => {
    mockPulls({ message: 'Not Found' });
    expect((await dependabotPrsProbe().run()).ok).toBe(true);
  });
});
