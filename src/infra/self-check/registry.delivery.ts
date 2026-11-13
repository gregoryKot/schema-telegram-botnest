import { Probe } from './types';
import { postboxProbe } from './probe-postbox';
import { webPushProbe } from './probe-web-push';

/**
 * Живые пробы каналов доставки: почта (Postbox) и уведомления в приложении.
 * Вынесены из registry.live.ts, чтобы файл с перечнем проб не рос (правило №10).
 */
export function deliveryProbes(): Probe[] {
  return [postboxProbe(), webPushProbe()];
}
