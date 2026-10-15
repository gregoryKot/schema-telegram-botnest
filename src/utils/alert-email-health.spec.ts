import { Logger } from '@nestjs/common';
import {
  LOG_REPEAT_MS,
  getAlertEmailHealth,
  noteAlertEmailResult,
  resetAlertEmailHealth,
} from './alert-email-health';

const PREFIX = 'Резервный канал алертов (Resend) не принял письмо: ';
const MSG_403 = `${PREFIX}HTTP 403`;
const MSG_429 = `${PREFIX}HTTP 429`;

describe('alert-email-health', () => {
  let warn: jest.SpyInstance;
  const lines = () => warn.mock.calls.map((c) => String(c[0]));
  beforeEach(() => {
    resetAlertEmailHealth();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('до первой отправки снимок пустой', () => {
    expect(getAlertEmailHealth()).toEqual({
      at: null,
      ok: true,
      status: null,
      lastOkAt: null,
    });
  });

  it('тот же отказ повторяется в логе не чаще окна, потом снова', () => {
    noteAlertEmailResult({ ok: false, status: 403 }, 1_000);
    noteAlertEmailResult({ ok: false, status: 403 }, 2_000);
    expect(lines()).toEqual([MSG_403]);
    noteAlertEmailResult({ ok: false, status: 403 }, 1_000 + LOG_REPEAT_MS);
    expect(lines()).toEqual([MSG_403, MSG_403]);
  });

  it('другой статус логируется сразу', () => {
    noteAlertEmailResult({ ok: false, status: 429 }, 1_000);
    noteAlertEmailResult({ ok: false, status: 403 }, 2_000);
    expect(lines()).toEqual([MSG_429, MSG_403]);
  });

  it('после успеха тот же отказ снова виден в логе, lastOkAt сохраняется', () => {
    noteAlertEmailResult({ ok: false, status: 403 }, 1_000);
    noteAlertEmailResult({ ok: true }, 2_000);
    noteAlertEmailResult({ ok: false, status: 403 }, 3_000);
    expect(lines()).toEqual([MSG_403, MSG_403]);
    expect(getAlertEmailHealth()).toEqual({
      at: 3_000,
      ok: false,
      status: 403,
      lastOkAt: 2_000,
    });
  });
});
