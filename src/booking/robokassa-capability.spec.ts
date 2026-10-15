import { buildCapabilityReport } from '../infra/capability-report';
import {
  buildRobokassaCapability,
  missingRobokassaVars,
} from './robokassa-capability';

const FULL = {
  ROBOKASSA_MERCHANT_LOGIN: 'shop',
  ROBOKASSA_PASSWORD1: 'p1',
  ROBOKASSA_PASSWORD2: 'p2',
};

describe('buildRobokassaCapability', () => {
  it('все три переменные заданы — on', () => {
    const cap = buildRobokassaCapability(FULL);
    expect(cap.on).toBe(true);
    expect(cap.id).toBe('robokassaPayments');
    expect(cap.critical).toBe(false);
  });

  it.each(Object.keys(FULL))(
    'нет %s — off, и причина называет переменную',
    (k) => {
      const cap = buildRobokassaCapability({ ...FULL, [k]: undefined });
      expect(cap.on).toBe(false);
      expect(cap.offReason).toContain(k);
    },
  );

  it('пробелы вместо значения считаются «не задано»', () => {
    expect(
      missingRobokassaVars({ ...FULL, ROBOKASSA_PASSWORD2: '   ' }),
    ).toEqual(['ROBOKASSA_PASSWORD2']);
  });

  it('причина простыми словами объясняет последствие в проде', () => {
    const cap = buildRobokassaCapability({});
    expect(cap.offReason).toContain('отказывают');
    expect(cap.offReason.length).toBeGreaterThan(10);
  });

  it('запись входит в общий отчёт возможностей ровно один раз', () => {
    const ids = buildCapabilityReport({}).map((c) => c.id);
    expect(ids.filter((id) => id === 'robokassaPayments')).toHaveLength(1);
  });
});
