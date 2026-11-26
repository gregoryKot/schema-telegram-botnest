// Отказ обмена подписи на сессию (находка 2026-11-08): сайт в мессенджере не
// мог войти, а /stats этого не видел — отказ уходил только в журнал
// безопасности. Здесь: причина и платформа классифицируются, в meta ровно три
// ключа без сырых данных, повтор с того же IP в окне строку не пишет.
// Троттлинг общий на модуль — у каждого теста свой IP.
import { reportExchangeFailure } from './exchange-failure.report';

const EXPIRED = new Error('init data expired');
const FORGED = new Error('Invalid initData signature');

function run(
  err: unknown,
  ip: string | undefined,
  now = 1_000_000,
  rawPlatform: unknown = 'ios',
  host: 'telegram' | 'max' = 'telegram',
) {
  const track = jest.fn();
  reportExchangeFailure(err, host, rawPlatform, ip, { track, now });
  return track;
}

describe('reportExchangeFailure', () => {
  it('просроченная подпись → reason expired', () => {
    const track = run(EXPIRED, '203.0.113.1');
    expect(track).toHaveBeenCalledWith({
      host: 'telegram',
      platform: 'ios',
      reason: 'expired',
    });
  });

  it('подделка (и любая другая ошибка) → reason suspicious', () => {
    expect(run(FORGED, '203.0.113.2')).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'suspicious' }),
    );
    expect(run('строка вместо ошибки', '203.0.113.3')).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'suspicious' }),
    );
  });

  it('незнакомая или пустая платформа пишется как other', () => {
    expect(run(FORGED, '203.0.113.4', 1, 'tizen<script>')).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'other' }),
    );
    expect(run(FORGED, '203.0.113.5', 1, '')).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'other' }),
    );
  });

  it('в meta ровно площадка, платформа и причина — ни текста ошибки, ни IP', () => {
    const track = run(FORGED, '203.0.113.6', 1, 'desktop', 'max');
    const meta = track.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(meta).sort()).toEqual(['host', 'platform', 'reason']);
    expect(meta).toEqual({
      host: 'max',
      platform: 'desktop',
      reason: 'suspicious',
    });
    expect(JSON.stringify(meta)).not.toContain('203.0.113.6');
    expect(JSON.stringify(meta)).not.toContain('signature');
  });

  const tgExpired = { host: 'telegram', platform: 'ios', reason: 'expired' };

  it('повтор с того же IP в окне не пишется, после окна — пишется', () => {
    const ip = '203.0.113.7';
    const t0 = 10_000_000;
    expect(run(EXPIRED, ip, t0).mock.calls).toEqual([[tgExpired]]);
    expect(run(EXPIRED, ip, t0 + 60_000).mock.calls).toEqual([]);
    // Другая причина в том же окне — та же попытка входа, строки нет.
    expect(run(FORGED, ip, t0 + 4 * 60_000).mock.calls).toEqual([]);
    expect(run(EXPIRED, ip, t0 + 5 * 60_000).mock.calls).toEqual([[tgExpired]]);
  });

  it('другой IP в том же окне пишется отдельно', () => {
    const t0 = 20_000_000;
    expect(run(EXPIRED, '203.0.113.8', t0).mock.calls).toEqual([[tgExpired]]);
    expect(run(EXPIRED, '203.0.113.9', t0).mock.calls).toEqual([[tgExpired]]);
  });

  it('тот же IP в другой площадке — своё окно', () => {
    const ip = '203.0.113.10';
    expect(run(EXPIRED, ip, 30_000_000).mock.calls).toEqual([[tgExpired]]);
    expect(run(EXPIRED, ip, 30_000_000, 'ios', 'max').mock.calls).toEqual([
      [{ ...tgExpired, host: 'max' }],
    ]);
  });

  it('без IP — общий ключ no-ip, троттлинг всё равно работает', () => {
    expect(run(EXPIRED, undefined, 40_000_000).mock.calls).toEqual([
      [tgExpired],
    ]);
    expect(run(EXPIRED, undefined, 40_000_001).mock.calls).toEqual([]);
  });
});
