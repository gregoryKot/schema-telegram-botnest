import { createHash } from 'crypto';

// Ключ клиента для ClientMeeting и комната Jitsi — вынесены из meeting.service.ts
// (правило №10: сервис упирался в потолок размера).

/** Normalise a contact (telegram/phone) so the same person maps to one key. */
export function clientKey(contact: string): string {
  const norm = contact
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[\s()+-]/g, '');
  return createHash('sha256').update(norm).digest('hex');
}

export function jitsiRoom(key: string): string {
  return `https://meet.jit.si/schemehappens-${key.slice(0, 12)}`;
}
