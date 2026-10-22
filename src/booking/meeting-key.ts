import { createHash } from 'crypto';

// Ключ клиента для ClientMeeting — вынесен из meeting.service.ts (правило №10:
// сервис упирался в потолок размера). Комната Jitsi — в meeting-jitsi.ts.

/** Normalise a contact (telegram/phone) so the same person maps to one key. */
export function clientKey(contact: string): string {
  const norm = contact
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[\s()+-]/g, '');
  return createHash('sha256').update(norm).digest('hex');
}
