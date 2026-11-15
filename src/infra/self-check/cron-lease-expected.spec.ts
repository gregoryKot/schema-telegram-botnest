// Аренда крона за выключенной фичей не судится пробой cronLeases: крон её
// не берёт (гард до claimRun), иначе проба краснела бы каждый час.
import { ConfigService } from '@nestjs/config';
import {
  expectedLeases,
  LEASE_FEATURE_FLAG,
  LEASE_REQUIRED_ENV,
} from './cron-lease-expected';
import { CRON_LEASE_REGISTRY } from './cron-lease-registry';
import { CalDavService } from '../../booking/caldav.service';
import { SubscriptionService } from '../../subscription/subscription.service';

type Env = Record<string, string | undefined>;
const ALL = Object.keys(CRON_LEASE_REGISTRY);
const ICLOUD = { APPLE_ID: 'owner@icloud.com', APPLE_APP_PASSWORD: 'pw' };
const configOf = (env: Env) =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;

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

  // Правило №4: проба ждёт аренду списаний ровно тогда, когда сервис включён.
  // Сверяется поведение, не текст: в песочнице Stryker исходник инструментирован.
  it('аренда списаний подписки ожидается ровно при SubscriptionService.isEnabled()', () => {
    const flag = LEASE_FEATURE_FLAG.subscriptionChargeDue;
    const envs: Env[] = [
      {},
      { [flag]: 'true' },
      { [flag]: 'false' },
      { [flag]: 'TRUE' },
    ];
    const verdicts = envs.map((env) => {
      const service = new SubscriptionService(
        {} as never,
        {} as never,
        {} as never,
        configOf(env),
        {} as never,
      );
      return [
        service.isEnabled(),
        expectedLeases(env).includes('subscriptionChargeDue'),
      ];
    });
    expect(verdicts).toEqual([
      [false, false],
      [true, true],
      [false, false],
      [false, false],
    ]);
  });

  // Правило №4: проба ждёт аренду сверки ровно тогда, когда гард крона пускает.
  it('аренда сверки календаря ожидается ровно при CalDavService.enabled', () => {
    const envs: Env[] = [
      {},
      ICLOUD,
      { APPLE_ID: ICLOUD.APPLE_ID },
      { APPLE_APP_PASSWORD: ICLOUD.APPLE_APP_PASSWORD },
      { ...ICLOUD, APPLE_ID: '' },
    ];
    const verdicts = envs.map((env) => [
      new CalDavService(configOf(env)).enabled,
      expectedLeases(env).includes('bookingCalendarReconcile'),
    ]);
    expect(verdicts).toEqual([
      [false, false],
      [true, true],
      [false, false],
      [false, false],
      [false, false],
    ]);
  });
});
