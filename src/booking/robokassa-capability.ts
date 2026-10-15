// Запись реестра возможностей «приём оплаты через Robokassa»
// (capability-report.ts, правило №21). Выключенная по конфигурации возможность
// — не авария сама по себе, но молчать о ней нельзя: до аудита 2026-10-11
// снятые переменные в проде молча превращались в «бесплатные сессии».
import type { CapabilityStatus } from '../infra/capability-report';

type Env = Record<string, string | undefined>;

export const ROBOKASSA_REQUIRED_VARS = [
  'ROBOKASSA_MERCHANT_LOGIN',
  'ROBOKASSA_PASSWORD1',
  'ROBOKASSA_PASSWORD2',
] as const;

export function missingRobokassaVars(env: Env): string[] {
  return ROBOKASSA_REQUIRED_VARS.filter((k) => !env[k]?.trim());
}

export function buildRobokassaCapability(env: Env): CapabilityStatus {
  const missing = missingRobokassaVars(env);
  return {
    id: 'robokassaPayments',
    title: 'Приём оплаты (Robokassa)',
    on: missing.length === 0,
    envVars: [...ROBOKASSA_REQUIRED_VARS],
    offReason:
      'Оплата не настроена: в проде платная сессия, донат и подписка ' +
      'отказывают (503), вне прода подтверждаются без денег. ' +
      `Не заданы ${missing.join(', ')}.`,
    files: ['src/booking/robokassa.service.ts', 'src/booking/payment-guard.ts'],
    critical: false,
  };
}
