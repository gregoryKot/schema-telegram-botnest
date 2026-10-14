// Наблюдатель за CI в приложении (CLAUDE.md, правило №21/№24): GitHub-джоба
// `alarm` шлёт DM только при секретах BOT_TOKEN/ADMIN_ID в репозитории, а
// приложение знает эти секреты всегда (и не зависит от планировщика GitHub:
// проба сверяет ещё и возраст прогона). Фикстура — настоящий ответ GitHub
// REST (test/fixtures/recorded/github-workflow-runs.json, правило №14: «тест
// стоит на шве, не рядом»).
import { ciRunsProbe } from './probe-ci-runs';
import { loadRecordedFixture } from '../../test-support/recorded-fixture';

const FIXTURE = 'github-workflow-runs.json';

const originalFetch = global.fetch;

// Прогон в фикстуре — 2026-09-17T01:23:13Z; «сейчас» стоит через 3 часа после
// него, то есть в пределах порога возраста смока (8 ч) и nightly (36 ч).
const FIXTURE_RUN_AT = Date.parse('2026-09-17T01:23:13Z');
const HOUR = 3_600_000;
function setNow(msAfterRun: number) {
  jest.spyOn(Date, 'now').mockReturnValue(FIXTURE_RUN_AT + msAfterRun);
}

beforeEach(() => setNow(3 * HOUR));

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

  it('спрашивает прогоны только ветки main: ручной прогон на ветке PR не становится «последним»', async () => {
    const fixture = JSON.parse(loadRecordedFixture(FIXTURE));
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(fixture));
    global.fetch = fetchMock as never;

    await ciRunsProbe().run();

    for (const call of fetchMock.mock.calls) {
      expect(new URL(call[0] as string).searchParams.get('branch')).toBe(
        'main',
      );
    }
  });

  describe('возраст последнего прогона (планировщик GitHub мог перестать запускать)', () => {
    // Смок и nightly в тесте отдают одну и ту же запись; порог у них разный
    // (14 ч и 40 ч), поэтому ответ собирается по имени воркфлоу из URL.
    function respondByWorkflow(ageHours: { smoke: number; nightly: number }) {
      const fixture = JSON.parse(loadRecordedFixture(FIXTURE));
      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        const age = url.includes('prod-smoke.yml')
          ? ageHours.smoke
          : ageHours.nightly;
        const run = {
          ...fixture.workflow_runs[0],
          updated_at: new Date(FIXTURE_RUN_AT).toISOString(),
        };
        setNow(age * HOUR);
        return jsonResponse({ workflow_runs: [run] });
      }) as never;
    }

    it('смок зелёный, но старше 14 часов — не ok, «смок не запускался N ч»', async () => {
      respondByWorkflow({ smoke: 15, nightly: 1 });
      const res = await ciRunsProbe().run();
      expect(res.ok).toBe(false);
      expect(res.detail).toContain('смок не запускался 15 ч');
      expect(res.detail).toContain('/actions/runs/');
      expect(res.detail).not.toContain('ночная проверка');
    });

    it('смок ровно на пороге (14 ч) — ещё ok: самый длинный замеренный разрыв — 12,1 ч', async () => {
      respondByWorkflow({ smoke: 14, nightly: 1 });
      expect((await ciRunsProbe().run()).ok).toBe(true);
    });

    it('nightly старше 40 часов — не ok; 39 часов — ok', async () => {
      respondByWorkflow({ smoke: 1, nightly: 41 });
      const stale = await ciRunsProbe().run();
      expect(stale.ok).toBe(false);
      expect(stale.detail).toContain('ночная проверка не запускалась 41 ч');

      respondByWorkflow({ smoke: 1, nightly: 39 });
      expect((await ciRunsProbe().run()).ok).toBe(true);
    });

    it('красный И старый прогон — в detail обе причины', async () => {
      const fixture = JSON.parse(loadRecordedFixture(FIXTURE));
      fixture.workflow_runs[0].conclusion = 'failure';
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonResponse(fixture)) as never;
      setNow(50 * HOUR);

      const res = await ciRunsProbe().run();
      expect(res.detail).toContain('смок прода красный');
      expect(res.detail).toContain('смок не запускался 50 ч');
    });

    it('время старта (run_started_at) важнее updated_at: долгий прогон считается от старта', async () => {
      const fixture = JSON.parse(loadRecordedFixture(FIXTURE));
      fixture.workflow_runs[0].run_started_at = new Date(
        FIXTURE_RUN_AT - 15 * HOUR,
      ).toISOString();
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonResponse(fixture)) as never;
      // updated_at — 1 час назад, а стартовал прогон 15 часов назад.
      setNow(HOUR);

      const res = await ciRunsProbe().run();
      expect(res.ok).toBe(false);
      expect(res.detail).toContain('смок не запускался 16 ч');
    });

    it('GitHub не отдал время прогона — возраст не судим, решает conclusion', async () => {
      const fixture = JSON.parse(loadRecordedFixture(FIXTURE));
      delete fixture.workflow_runs[0].updated_at;
      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonResponse(fixture)) as never;
      setNow(1000 * HOUR);

      expect((await ciRunsProbe().run()).ok).toBe(true);
    });
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
