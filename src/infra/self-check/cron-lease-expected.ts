import { CRON_LEASE_REGISTRY } from './cron-lease-registry';

// Аренды, которые проба cronLeases обязана видеть. Крон за выключенной фичей
// аренду не берёт — дешёвый гард стоит до claimRun (правило №17), — и без
// этой сверки проба каждый час писала бы владельцу «ни разу не отработал».
// Имя аренды → env-флаг фичи; флаг читается так же, как у самой фичи (=== 'true').
export const LEASE_FEATURE_FLAG: Record<string, string> = {
  subscriptionChargeDue: 'SUBSCRIPTION_ENABLED',
};

export function expectedLeases(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return Object.keys(CRON_LEASE_REGISTRY).filter((name) => {
    const flag = LEASE_FEATURE_FLAG[name];
    return !flag || env[flag] === 'true';
  });
}
