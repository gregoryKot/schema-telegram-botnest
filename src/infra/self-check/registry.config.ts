import { Probe } from './types';
import { oauthRedirectsProbe, alertsProbe } from './probe-capabilities';
import { emailProbe } from './probe-email';
import { runtimeModeProbe } from './probe-runtime-mode';
import { clientIpProbe } from './probe-client-ip';

/**
 * Пробы конфигурации и режима процесса (без живых запросов на площадки).
 * Вынесены из registry.ts, чтобы файл с перечнем проб не рос с каждой новой
 * пробой конфигурации.
 */
export function configProbes(): Probe[] {
  return [
    oauthRedirectsProbe(),
    emailProbe(),
    alertsProbe(),
    runtimeModeProbe(),
    clientIpProbe(),
  ];
}
