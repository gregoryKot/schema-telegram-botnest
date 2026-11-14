// Аренда крона за выключенной фичей не судится пробой cronLeases: крон её
// не берёт (гард до claimRun), иначе проба краснела бы каждый час.
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import {
  expectedLeases,
  LEASE_FEATURE_FLAG,
  LEASE_REQUIRED_ENV,
} from './cron-lease-expected';
import { CRON_LEASE_REGISTRY } from './cron-lease-registry';
import { CalDavService } from '../../booking/caldav.service';

const ALL = Object.keys(CRON_LEASE_REGISTRY);
const ICLOUD = { APPLE_ID: 'owner@icloud.com', APPLE_APP_PASSWORD: 'pw' };

describe('expectedLeases', () => {
  it('подписка выключена (флага нет или не "true") — её аренда не ожидается, остальные на месте', () => {
    for (const env of [ICLOUD, { ...ICLOUD, SUBSCRIPTION_ENABLED: 'false' }]) {
      const names = expectedLeases(env);
      expect(names).not.toContain('subscriptionChargeDue');
      expect(names).toEqual(ALL.filter((n) => n !== 'subscriptionChargeDue'));
    }
  });

  it('подписка включена и iCloud настроен — ожидаются все аренды реестра', () => {
    expect(expectedLeases({ ...ICLOUD, SUBSCRIPTION_ENABLED: 'true' })).toEqual(
      ALL,
    );
  });

  it('iCloud не настроен — сверка календаря не ожидается, остальные на месте', () => {
    const env = { SUBSCRIPTION_ENABLED: 'true' };
    expect(expectedLeases(env)).toEqual(
      ALL.filter((n) => n !== 'bookingCalendarReconcile'),
    );
  });

  it('каждое имя с флагом или env — настоящая аренда реестра (протухшее имя красит тест)', () => {
    const gated = [
      ...Object.keys(LEASE_FEATURE_FLAG),
      ...Object.keys(LEASE_REQUIRED_ENV),
    ];
    for (const name of gated) expect(ALL).toContain(name);
  });

  // Правило №4: флаг пробы и флаг самой фичи — одно и то же имя env.
  it('SubscriptionService читает тот же флаг, что сверяет проба', () => {
    const src = readFileSync(
      join(__dirname, '../../subscription/subscription.service.ts'),
      'utf8',
    );
    expect(src).toContain(
      `get<string>('${LEASE_FEATURE_FLAG.subscriptionChargeDue}') === 'true'`,
    );
  });

  // Правило №4: проба ждёт аренду сверки ровно тогда, когда гард крона пускает.
  it('аренда сверки календаря ожидается ровно при CalDavService.enabled', () => {
    const envs: Record<string, string | undefined>[] = [
      {},
      ICLOUD,
      { APPLE_ID: ICLOUD.APPLE_ID },
      { APPLE_APP_PASSWORD: ICLOUD.APPLE_APP_PASSWORD },
      { ...ICLOUD, APPLE_ID: '' },
    ];
    const verdicts = envs.map((env) => {
      const config = { get: (k: string) => env[k] } as unknown as ConfigService;
      return [
        new CalDavService(config).enabled,
        expectedLeases(env).includes('bookingCalendarReconcile'),
      ];
    });
    expect(verdicts).toEqual([
      [false, false],
      [true, true],
      [false, false],
      [false, false],
      [false, false],
    ]);
  });
});
