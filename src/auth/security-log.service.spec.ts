// security-log.service.ts (80 lines) — the audit trail + admin-DM trigger for
// security-relevant events (merge, 2FA, CSRF, suspicious initData...).
// Covers: every event is logged, only ALERT_EVENTS DM the admin, and secrets
// never leak into either channel. Admin delivery (notifyAdminWithFallback)
// is mocked at the module boundary — no network I/O, no dependency on
// admin-alert.ts's own env-driven behavior (covered by admin-alert.spec.ts).
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
