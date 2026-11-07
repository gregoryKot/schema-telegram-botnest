import type { CrossCheck } from './env-check';
import { ORIGIN_CROSS_CHECKS } from './env-check.origins';

// Кросс-проверки хостов (вынесены из env-check.ts: файл упирался в потолок
// размера, правило №10): CORS-origin.
export const HOST_CROSS_CHECKS: CrossCheck[] = [...ORIGIN_CROSS_CHECKS];
