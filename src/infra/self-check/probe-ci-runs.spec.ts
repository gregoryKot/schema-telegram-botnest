// Наблюдатель за CI переехал в приложение (CLAUDE.md, правило №21/№24):
// GitHub-джоба `alarm` не может слать DM без секретов BOT_TOKEN/ADMIN_ID в
// самом репозитории (их там нет, run 35103908387 — DM не ушёл), а
// приложение эти секреты знает (Amvera). Фикстура — настоящий ответ GitHub
// REST (test/fixtures/recorded/github-workflow-runs.json, правило №14: «тест
// стоит на шве, не рядом»).
import { ciRunsProbe } from './probe-ci-runs';
import { loadRecordedFixture } from '../../test-support/recorded-fixture';

const FIXTURE = 'github-workflow-runs.json';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('ciRunsProbe', () => {
  it('reportInHealth: false — падение не обязано красить /health (иначе смок красил бы сам себя)', () => {
    expect(ciRunsProbe().reportInHealth).toBe(false);
  });

  it('оба воркфлоу зелёные (реальный ответ GitHub) — ok, без сети сверх двух вызовов', async () => {
    const fixture = JSON.parse(loadRecordedFixture(FIXTURE));
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(fixture));
    global.fetch = fetchMock as never;

    const res = await ciRunsProbe().run();

    expect(res).toEqual({ ok: true, detail: 'оба воркфлоу зелёные на GitHub' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls[0]).toContain('/workflows/nightly.yml/runs');
    expect(urls[1]).toContain('/workflows/prod-smoke.yml/runs');
    expect(urls[0]).toContain('status=completed');
  });

  // Тот же реальный ответ, только conclusion подменён на failure — форма
  // ответа (html_url, вложенность workflow_runs[0]) остаётся настоящей.
  it('последний прогон red (conclusion: failure) — не ok, detail содержит ссылку на прогон', async () => {
    const fixture = JSON.parse(loadRecordedFixture(FIXTURE));
    fixture.workflow_runs[0].conclusion = 'failure';
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(fixture));
    global.fetch = fetchMock as never;

    const res = await ciRunsProbe().run();

    expect(res.ok).toBe(false);
    expect(res.detail).toContain(fixture.workflow_runs[0].html_url);
    expect(res.detail).toContain('ночная проверка упала');
    expect(res.detail).toContain('смок прода красный');
  });

  it('cancelled засчитывается так же, как failure — не success значит не ok', async () => {
    const fixture = JSON.parse(loadRecordedFixture(FIXTURE));
    fixture.workflow_runs[0].conclusion = 'cancelled';
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(fixture)) as never;

    const res = await ciRunsProbe().run();
    expect(res.ok).toBe(false);
  });

  it('workflow_runs пуст (воркфлоу ещё ни разу не завершался) — ok, честный detail', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ total_count: 0, workflow_runs: [] }),
      ) as never;

    const res = await ciRunsProbe().run();
    expect(res).toEqual({ ok: true, detail: 'прогонов ещё не было' });
  });

  it('сеть недоступна — не ok, detail начинается с «не удалось узнать состояние CI»', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network unreachable')) as never;

    const res = await ciRunsProbe().run();
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/^не удалось узнать состояние CI/);
    expect(res.detail).toContain('network unreachable');
  });

  it('таймаут (AbortError) — не ok, тот же честный префикс', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new DOMException('The operation was aborted', 'AbortError'),
      ) as never;

    const res = await ciRunsProbe().run();
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/^не удалось узнать состояние CI/);
  });

  it('GitHub отвечает HTTP-ошибкой (403 — лимит запросов) — не ok, честный detail, не «выключено»', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    }) as never;

    const res = await ciRunsProbe().run();
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/^не удалось узнать состояние CI/);
    expect(res.detail).toContain('403');
  });
});
