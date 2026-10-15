import { Probe } from './types';
import {
  oauthRedirectsProbe,
  emailProbe,
  alertsProbe,
} from './probe-capabilities';
import { runtimeModeProbe } from './probe-runtime-mode';

/**
 * Пробы конфигурации и режима процесса (без живых запросов на площадки).
 * Вынесены из registry.ts: тот под храповиком размера (правило №10).
 */
export function configProbes(): Probe[] {
  return [
    oauthRedirectsProbe(),
    emailProbe(),
    alertsProbe(),
    runtimeModeProbe(),
  ];
}
