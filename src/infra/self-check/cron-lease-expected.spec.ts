// Аренда крона за выключенной фичей не судится пробой cronLeases: крон её
// не берёт (гард до claimRun), иначе проба краснела бы каждый час.
import { readFileSync } from 'fs';
import { join } from 'path';
import { expectedLeases, LEASE_FEATURE_FLAG } from './cron-lease-expected';
import { CRON_LEASE_REGISTRY } from './cron-lease-registry';

const ALL = Object.keys(CRON_LEASE_REGISTRY);

describe('expectedLeases', () => {
  it('подписка выключена (флага нет или не "true") — её аренда не ожидается, остальные на месте', () => {
    for (const env of [{}, { SUBSCRIPTION_ENABLED: 'false' }]) {
      const names = expectedLeases(env);
      expect(names).not.toContain('subscriptionChargeDue');
      expect(names).toEqual(ALL.filter((n) => n !== 'subscriptionChargeDue'));
    }
  });

  it('подписка включена — ожидаются все аренды реестра', () => {
    expect(expectedLeases({ SUBSCRIPTION_ENABLED: 'true' })).toEqual(ALL);
  });

  it('каждое имя с флагом — настоящая аренда реестра (протухшее имя красит тест)', () => {
    for (const name of Object.keys(LEASE_FEATURE_FLAG))
      expect(ALL).toContain(name);
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
});
