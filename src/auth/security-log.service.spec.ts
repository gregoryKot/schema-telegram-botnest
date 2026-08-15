// security-log.service.ts — the audit trail + admin-DM trigger for
// security-relevant events (merge, 2FA, CSRF, suspicious initData...).
// Covers: every event is logged, only ALERT_EVENTS DM the admin, and secrets
// never leak into either channel. Admin delivery (notifyAdminWithFallback)
// is mocked at the module boundary — no network I/O, no dependency on
// admin-alert.ts's own env-driven behavior (covered by admin-alert.spec.ts).
//
// Регресс инцидента 2026-07-29 (шквал DM = замьюченный чат = ноль алертов),
// перенесённый на call sites, которые тот фикс не покрыл: `csrf_blocked`
// (auth-http.util.ts) и `refresh_token_reuse` (auth.service.ts) слали DM без
// единого троттлинга. Троттлинг теперь живёт в самом канале доставки
// (SecurityLogService), а не у вызывающего — новый call site защищён по
// умолчанию, ему не нужно об этом помнить. Часы инжектируются (как в
// auth-failure.report.ts) — тесты бюджета детерминированы, без реальных
// таймеров.
import { Logger } from '@nestjs/common';
import { SecurityLogService } from './security-log.service';
import { notifyAdminWithFallback } from '../utils/admin-alert';

jest.mock('../utils/admin-alert', () => ({
  notifyAdminWithFallback: jest.fn().mockResolvedValue(undefined),
}));

const mockedNotify = notifyAdminWithFallback as jest.Mock;
const flush = () => new Promise((r) => setImmediate(r));

let logSpy: jest.SpiedFunction<typeof Logger.prototype.log>;

beforeEach(() => {
  mockedNotify.mockClear();
  logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SecurityLogService — every event is logged', () => {
  it('writes a structured line via Logger.log for a non-alert event', () => {
    const service = new SecurityLogService();
    service.log('login_success', { userId: 1 });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[login_success]'),
    );
  });
});

describe('SecurityLogService — only ALERT_EVENTS DM the admin', () => {
  const ALERT_EVENTS = [
    'merge_confirmed',
    'role_changed',
    'therapist_request_submitted',
    'csrf_blocked',
    'suspicious_initdata',
    'refresh_token_reuse',
  ] as const;

  const NON_ALERT_EVENTS = [
    'login_success',
    'login_failed',
    'merge_initiated',
    'provider_linked',
    'provider_unlinked',
    'therapist_request_decided',
    'rate_limited',
  ] as const;

  it.each(ALERT_EVENTS)(
    '%s triggers notifyAdminWithFallback',
    async (event) => {
      const service = new SecurityLogService();
      service.log(event, { endpoint: 'x' });
      await flush();
      expect(mockedNotify).toHaveBeenCalledTimes(1);
      expect(mockedNotify.mock.calls[0][1]).toBe(`🔐 Security: ${event}`);
    },
  );

  it.each(NON_ALERT_EVENTS)(
    '%s does NOT trigger notifyAdminWithFallback',
    async (event) => {
      const service = new SecurityLogService();
      service.log(event, { endpoint: 'x' });
      await flush();
      expect(mockedNotify).not.toHaveBeenCalled();
      // Не-алертное событие всё равно попадает в обычный лог — молчит только DM.
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[${event}]`),
      );
    },
  );

  it('a rejected admin DM never throws out of log() (fire-and-forget .catch)', async () => {
    mockedNotify.mockRejectedValueOnce(new Error('telegram + email both down'));
    const service = new SecurityLogService();
    expect(() => service.log('csrf_blocked', { endpoint: 'x' })).not.toThrow();
    await flush(); // let the rejected promise settle before the test ends
  });
});

describe('SecurityLogService — redaction', () => {
  it('redacts token/password/secret-like keys and initData in the log line', () => {
    const service = new SecurityLogService();
    service.log('login_failed', {
      accessToken: 'super-secret-value',
      password: 'hunter2',
      apiSecret: 'sk-live-xyz',
      initData: 'query_id=abc&hash=def',
      userId: 5,
    });
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).not.toContain('super-secret-value');
    expect(line).not.toContain('hunter2');
    expect(line).not.toContain('sk-live-xyz');
    expect(line).not.toContain('query_id=abc');
    expect(line).toContain('[redacted]');
    expect(line).toContain('"userId":5'); // non-secret fields pass through
  });

  it('redacts secrets in the admin DM text too, not just the log line', async () => {
    const service = new SecurityLogService();
    service.log('csrf_blocked', {
      endpoint: 'refresh',
      refreshToken: 'raw-refresh-value',
    });
    await flush();
    const text = mockedNotify.mock.calls[0][0] as string;
    expect(text).not.toContain('raw-refresh-value');
    expect(text).toContain('[redacted]');
  });

  it('converts BigInt fields to strings so JSON.stringify never throws', () => {
    const service = new SecurityLogService();
    expect(() =>
      service.log('merge_initiated', { userId: 123_456_789_012_345n }),
    ).not.toThrow();
    expect(logSpy.mock.calls[0][0]).toContain('123456789012345');
  });
});

// Класс «троттлинг сигнализации живёт у ВЫЗЫВАЮЩЕГО, а не в канале доставки»
// (аудит после 2026-07-29): budget теперь встроен в SecurityLogService, и
// call site не обязан ничего помнить. Часы — injected, детерминированные,
// без setTimeout/jest.useFakeTimers.
describe('SecurityLogService — DM-бюджет по имени события', () => {
  const WINDOW_MS = 15 * 60_000;
  const K = 3; // ALERT_BUDGET_MAX_PER_WINDOW — держим синхронно с сервисом

  it('структурный лог не троттлится НИКОГДА, даже когда DM подавлен', () => {
    let now = 0;
    const service = new SecurityLogService(() => now);
    for (let i = 0; i < K + 20; i++) {
      now = i * 10;
      service.log('csrf_blocked', { endpoint: 'x' });
    }
    expect(logSpy).toHaveBeenCalledTimes(K + 20);
    // Не просто счётчик — каждая из K+20 строк реально содержит событие,
    // а не пустышку.
    for (const call of logSpy.mock.calls) {
      expect(call[0]).toContain('[csrf_blocked]');
    }
  });

  it('шквал одного события даёт максимум K DM за окно', async () => {
    let now = 0;
    const service = new SecurityLogService(() => now);
    for (let i = 0; i < 50; i++) {
      now = i * 10; // все 50 попаданий — внутри одного 15-минутного окна
      service.log('csrf_blocked', { endpoint: 'refresh' });
    }
    await flush();
    expect(mockedNotify).toHaveBeenCalledTimes(K);
    // Дошедшие K DM — все про то же событие, не про что-то другое.
    for (const call of mockedNotify.mock.calls) {
      expect(call[1]).toBe('🔐 Security: csrf_blocked');
    }
  });

  it('редкое событие для РАЗНЫХ пользователей — каждый получает свой DM', async () => {
    let now = 0;
    const service = new SecurityLogService(() => now);
    for (const userId of [1, 2, 3]) {
      now += 5 * 60_000; // разные пользователи, минуты друг от друга
      service.log('merge_confirmed', { userId });
    }
    await flush();
    // Три разных пользователя слили аккаунты — три отдельных DM, не один,
    // и каждый называет СВОЙ userId (а не последний/первый по ошибке).
    expect(mockedNotify.mock.calls.map((c) => c[0])).toEqual([
      expect.stringContaining('userId: 1'),
      expect.stringContaining('userId: 2'),
      expect.stringContaining('userId: 3'),
    ]);
  });

  it('DM после подавления называет число проглоченных', async () => {
    let now = 0;
    const service = new SecurityLogService(() => now);
    for (let i = 0; i < K; i++) {
      now = i * 10;
      service.log('csrf_blocked', { endpoint: 'x' });
    }
    for (let i = 0; i < 7; i++) {
      now = 1_000 + i * 10;
      service.log('csrf_blocked', { endpoint: 'x' }); // подавлены бюджетом
    }
    now = WINDOW_MS + 1; // новое окно — снова допущен
    service.log('csrf_blocked', { endpoint: 'x' });
    await flush();
    const lastText = mockedNotify.mock.calls.at(-1)?.[0] as string;
    expect(lastText).toContain('ещё 7 за окно');
  });

  // Свежий бюджет (suppressed=0) — хвост «ещё N за окно» вообще не должен
  // появляться. Точный toBe (не toContain) нужен, чтобы поймать мутанта,
  // подменяющего '' (пустую ветку тернарника) на непустую строку — toContain
  // такую подмену не ловит, если сам искомый текст не задет.
  it('первый DM в свежем окне: точный текст — заголовок + поля через \\n, без хвоста подавления', async () => {
    const service = new SecurityLogService(() => 0);
    service.log('csrf_blocked', { endpoint: 'refresh', method: 'POST' });
    await flush();
    const text = mockedNotify.mock.calls[0][0] as string;
    expect(text).toBe('🔐 csrf_blocked\nendpoint: refresh\nmethod: POST');
  });

  it('значение длиннее 80 символов обрезается в DM (защита от раздутого/injection-подобного значения)', async () => {
    const service = new SecurityLogService(() => 0);
    const longValue = 'x'.repeat(200);
    service.log('csrf_blocked', { payload: longValue });
    await flush();
    const text = mockedNotify.mock.calls[0][0] as string;
    expect(text).toBe(`🔐 csrf_blocked\npayload: ${'x'.repeat(80)}`);
  });

  it('разные имена событий не делят один бюджет', async () => {
    let now = 0;
    const service = new SecurityLogService(() => now);
    for (let i = 0; i < K; i++) {
      now = i * 10;
      service.log('csrf_blocked', { endpoint: 'x' });
    }
    // csrf_blocked уже упёрся в потолок этого окна — refresh_token_reuse
    // получает свой собственный бюджет и всё равно доставляется.
    now = 100;
    service.log('refresh_token_reuse', { userId: 1 });
    await flush();
    const subjects = mockedNotify.mock.calls.map((c) => c[1]);
    expect(subjects).toEqual([
      '🔐 Security: csrf_blocked',
      '🔐 Security: csrf_blocked',
      '🔐 Security: csrf_blocked',
      '🔐 Security: refresh_token_reuse',
    ]);
  });

  // Отрицательная ветка счётчика. Тест выше проверяет, что «ещё N за окно»
  // ПОЯВЛЯЕТСЯ, — и этого мало: мутация «приписывать всегда» (`suppressed >= 0`)
  // его переживала, потому что случай «ничего не подавлено» никто не смотрел.
  // Цена ошибки не косметическая: приписка «ещё 0 за окно» в каждом обычном
  // алерте — это ложный сигнал «часть событий проглочена» там, где ничего не
  // проглочено, то есть ровно та потеря доверия к каналу, ради которой бюджет
  // и заводился.
  it('обычный алерт (ничего не подавлено) — без приписки про окно', async () => {
    const service = new SecurityLogService(() => 0);
    service.log('merge_confirmed', { userId: 1 });
    await flush();
    const text = mockedNotify.mock.calls[0][0] as string;
    expect(text).toContain('merge_confirmed');
    expect(text).not.toContain('за окно');
  });
});
