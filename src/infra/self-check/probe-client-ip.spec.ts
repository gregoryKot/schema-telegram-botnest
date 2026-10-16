import {
  CDN_LIMIT,
  MIN_SAMPLES,
  UNRESOLVED_LIMIT,
  clientIpProbe,
} from './probe-client-ip';

const run = (total: number, unresolved = 0, cdnMarked = 0) =>
  clientIpProbe(() => ({ total, unresolved, cdnMarked })).run();

describe('clientIpProbe', () => {
  it('описание пробы: id, не критична, виден в /health', () => {
    const p = clientIpProbe(() => ({ total: 0, unresolved: 0, cdnMarked: 0 }));
    expect(p.id).toBe('clientIp');
    expect(p.critical).toBe(false);
    expect(p.reportInHealth).toBeUndefined();
  });

  it('пустая выборка и мало записей: ok, «проверять рано»', async () => {
    for (const total of [0, MIN_SAMPLES - 1]) {
      const r = await run(total, total, total);
      expect(r.ok).toBe(true);
      expect(r.detail).toContain('проверять рано');
    }
  });

  it('все адреса прокси: fail с подсказкой, что проверять', async () => {
    const r = await run(100, 100);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('адрес посетителя не доходит');
    expect(r.detail).toContain('trust proxy');
  });

  it('порог не дошедших адресов: 89% ok, 90% fail', async () => {
    expect((await run(100, 89)).ok).toBe(true);
    expect((await run(100, UNRESOLVED_LIMIT * 100)).ok).toBe(false);
  });

  it('порог меток CDN: 49% ok, 50% fail', async () => {
    expect((await run(100, 0, 49)).ok).toBe(true);
    const r = await run(100, 0, CDN_LIMIT * 100);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('CDN');
    expect(r.detail).toContain('trusted_proxies');
  });

  it('обе беды сразу: обе названы', async () => {
    const r = await run(100, 100, 100);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('не доходит');
    expect(r.detail).toContain('CDN');
  });

  it('нормальный трафик: ok, числа без адресов', async () => {
    const r = await run(120, 6, 0);
    expect(r.ok).toBe(true);
    expect(r.detail).toBe(
      'адрес посетителя доходит: 114 из 120 недавних запросов с публичным адресом',
    );
    expect(r.detail).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('ровно MIN_SAMPLES записей уже оцениваются', async () => {
    expect((await run(MIN_SAMPLES, MIN_SAMPLES)).ok).toBe(false);
  });
});
