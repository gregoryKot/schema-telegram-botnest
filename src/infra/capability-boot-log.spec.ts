// Щит, волна 8: загрузочная сводка вызывается ВНЕ admin-alert.ts и обязана
// отдельной ERROR-строкой назвать мёртвую сигнализацию, а не смешать её с
// обычными info «выключено».
import { logCapabilityReport } from './capability-boot-log';

function fakeLogger() {
  return { log: jest.fn(), error: jest.fn() };
}

const ALL_CONFIGURED = {
  BOT_TOKEN: '123:abc',
  ADMIN_ID: '42',
  RESEND_API_KEY: 're_test',
  ADMIN_EMAIL: 'admin@example.com',
  ZOOM_ACCOUNT_ID: 'z1',
  ZOOM_CLIENT_ID: 'z2',
  ZOOM_CLIENT_SECRET: 'z3',
  ENCRYPTION_KEY: 'k'.repeat(64),
  HEALTHY_ADULT_THREADS_TOKEN: 'tok',
  JWT_SECRET: 'jwt-secret',
};

describe('logCapabilityReport', () => {
  it('всё настроено — одна info-строка, никакого error', () => {
    const logger = fakeLogger();
    logCapabilityReport(logger, ALL_CONFIGURED);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log.mock.calls[0][0]).toContain('всё подключено');
  });

  it('оба алерт-канала мертвы — ровно один error, называющий обе переменные', () => {
    const logger = fakeLogger();
    logCapabilityReport(logger, {});
    expect(logger.error).toHaveBeenCalledTimes(1);
    const msg = logger.error.mock.calls[0][0] as string;
    expect(msg).toContain('BOT_TOKEN');
    expect(msg).toContain('RESEND_API_KEY');
    expect(msg).toMatch(/мертва/);
  });

  it('мёртвая сигнализация не дублируется info-строками про её собственные каналы', () => {
    const logger = fakeLogger();
    logCapabilityReport(logger, {});
    const infoMessages = logger.log.mock.calls.map((c) => String(c[0]));
    // Сам факт «алерты в Telegram/на почту не уходят» уже сказан в error()
    // выше — эти две info-строки не дублируются (RESEND_API_KEY отдельно
    // всё ещё легитимно всплывает как причина ВЫКЛЮЧЕННОЙ emailDelivery —
    // это другая возможность, не алерт-канал).
    expect(infoMessages.some((m) => m.includes('Алерты в Telegram'))).toBe(
      false,
    );
    expect(
      infoMessages.some((m) => m.includes('Резервные алерты на почту')),
    ).toBe(false);
  });

  it('частично настроено (сигнализация жива) — обычные info-строки, без error', () => {
    const logger = fakeLogger();
    logCapabilityReport(logger, { BOT_TOKEN: '123:abc', ADMIN_ID: '42' });
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.log.mock.calls.length).toBeGreaterThan(0);
    const infoMessages = logger.log.mock.calls.map((c) => String(c[0]));
    expect(infoMessages.some((m) => m.includes('Выключено:'))).toBe(true);
  });
});
