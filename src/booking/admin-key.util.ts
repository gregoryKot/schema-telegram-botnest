import { ForbiddenException } from '@nestjs/common';

/** Throws unless the provided key matches the configured ADMIN_BOOKING_KEY. */
export function assertAdminKey(provided: string | undefined, expected: string): void {
  if (!expected || provided !== expected) {
    throw new ForbiddenException('Invalid admin key');
  }
}
