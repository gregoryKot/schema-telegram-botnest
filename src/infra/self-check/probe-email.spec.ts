import { Logger } from '@nestjs/common';
import { notifyAdminWithFallback } from '../../utils/admin-alert';
import {
  noteAlertEmailResponse,
  noteAlertEmailResult,
  resetAlertEmailHealth,
} from '../../utils/alert-email-health';
import { formatSelfCheck } from './format';
import { emailProbe, TRANSIENT_WINDOW_MS } from './probe-email';
import { runProbes } from './runner';

// Заглушки, не ключи.
const SECRET = 'test-secret-not-a-real-key';
const ENV = {
  POSTBOX_ACCESS_KEY_ID: 'TEST_KEY_ID',
  POSTBOX_SECRET_ACCESS_KEY: SECRET,
  ADMIN_EMAIL: 'a@b.ru',
};
const H = 3_600_000;
const NOW = 100 * H;

beforeEach(() => resetAlertEmailHealth());

describe('emailProbe', () => {
  it('не настроено — ok (резервный канал, не авария сама по себе)', async () => {
    const res = await emailProbe({}).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('не настроено');
  });

  it('не настроено — отказ в снимке не делает пробу красной', async () => {
    noteAlertEmailResult({ ok: false, status: 403 }, NOW);
    expect((await emailProbe({}, () => NOW).run()).ok).toBe(true);
  });

  it('настроено, писем не было — ok с честным текстом про проверку по первой отправке', async () => {
    const res = await emailProbe(ENV).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('настроено');
    expect(res.detail).toContain('первой реальной отправке');
  });

  it('403 — не ok, в detail статус и «ключ», сам ключ не раскрыт', async () => {
    noteAlertEmailResult({ ok: false, status: 403 }, NOW - 2 * H);
    const res = await emailProbe(ENV, () => NOW).run();
    expect(res.ok).toBe(false);
    expect(res.detail).toContain('HTTP 403');
    expect(res.detail).toContain('2 ч назад');
    expect(res.detail).not.toContain(SECRET);
  });

  it('задан только один из двух ключей Postbox — как «не настроено»', async () => {
    noteAlertEmailResult({ ok: false, status: 403 }, NOW);
    const half = { ...ENV, POSTBOX_SECRET_ACCESS_KEY: undefined };
    const res = await emailProbe(half, () => NOW).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('не настроено');
  });

  it('постоянный отказ (401) не «стареет»: красный и через сутки', async () => {
    noteAlertEmailResult({ ok: false, status: 401 }, NOW - 30 * H);
    expect((await emailProbe(ENV, () => NOW).run()).ok).toBe(false);
  });

  it('429 моложе окна — не ok, старше — ok с пометкой о давнем сбое', async () => {
    noteAlertEmailResult(
      { ok: false, status: 429 },
      NOW - TRANSIENT_WINDOW_MS + 1,
    );
    expect((await emailProbe(ENV, () => NOW).run()).ok).toBe(false);

    noteAlertEmailResult({ ok: false, status: 429 }, NOW - TRANSIENT_WINDOW_MS);
    const old = await emailProbe(ENV, () => NOW).run();
    expect(old.ok).toBe(true);
    expect(old.detail).toContain('давний');
  });

  it.each([500, 'network', 'timeout'] as const)(
    'временный сбой %s — не ok в окне',
    async (status) => {
      noteAlertEmailResult({ ok: false, status }, NOW - H);
      expect((await emailProbe(ENV, () => NOW).run()).ok).toBe(false);
    },
  );

  it('суточная квота (400 LimitExceededException) — временный сбой, а не постоянный отказ', async () => {
    noteAlertEmailResponse({
      ok: false,
      status: 400,
      error: 'LimitExceededException: Daily message quota exceeded',
    });
    const t = Date.now();
    const fresh = await emailProbe(ENV, () => t).run();
    expect(fresh.ok).toBe(false);
    expect(fresh.detail).toContain('квота');
    const old = await emailProbe(ENV, () => t + TRANSIENT_WINDOW_MS + H).run();
    expect(old.ok).toBe(true);
  });

  it('другой 400 (домен не подтверждён) — красный и после окна', async () => {
    noteAlertEmailResponse({
      ok: false,
      status: 400,
      error: 'MailFromDomainNotVerifiedException: domain not verified',
    });
    const later = Date.now() + TRANSIENT_WINDOW_MS + H;
    expect((await emailProbe(ENV, () => later).run()).ok).toBe(false);
  });

  it('отказ, затем успех — ok', async () => {
    noteAlertEmailResult({ ok: false, status: 401 }, NOW - 5 * H);
    noteAlertEmailResult({ ok: true }, NOW - H);
    const res = await emailProbe(ENV, () => NOW).run();
    expect(res.ok).toBe(true);
    expect(res.detail).toContain('принято');
  });
});

// Шов (правило №14): настоящая отправка → настоящий снимок → настоящая проба →
// настоящий отчёт /stats. Раньше проба читала только env и всегда отвечала ok.
describe('шов: отказ Postbox доходит до «Самопроверки»', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('Telegram не принял, Postbox ответил 403 → проба красная, /stats называет 403', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    process.env = { ...originalEnv, ...ENV, BOT_TOKEN: 't', ADMIN_ID: '1' };
    global.fetch = jest.fn((url: unknown) =>
      Promise.resolve(
        String(url).includes('telegram')
          ? { ok: false, status: 500 }
          : new Response('Forbidden\n', { status: 403 }),
      ),
    );

    await notifyAdminWithFallback('авария');
    const results = await runProbes([emailProbe(ENV)]);

    expect(results[0].ok).toBe(false);
    const report = formatSelfCheck({ ranAt: Date.now(), results });
    expect(report).toContain('Резервные алерты на почту');
    expect(report).toContain('403');
    expect(report).not.toContain(SECRET);
  });
});
