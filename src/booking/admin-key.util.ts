import { ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/** Throws unless the provided key matches the configured ADMIN_BOOKING_KEY.
 * Constant-time compare (project invariant: never `===` on secrets). An empty
 * configured key always rejects, so a missing env never opens the endpoint. */
export function assertAdminKey(provided: string | undefined, expected: string): void {
  const e = Buffer.from(expected ?? '', 'utf8');
  const p = Buffer.from(provided ?? '', 'utf8');
  if (!expected || e.length !== p.length || !timingSafeEqual(e, p)) {
    throw new ForbiddenException('Invalid admin key');
  }
}
