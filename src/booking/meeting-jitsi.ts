import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt, encrypt } from '../utils/crypto';
import type { MeetingLink } from './meeting-link';

// Комната Jitsi клиента (аудит 2026-10). Раньше адрес считался из контакта:
// `schemehappens-<sha256(контакт)[0..12]>` — знающий контакт вычислял комнату
// без запроса (у meet.jit.si нет ни пароля, ни зала ожидания). Теперь имя
// случайное: адрес хранится в ClientMeeting (зашифрован, D-9), не пересчитывается.
const JITSI_PREFIX = 'https://meet.jit.si/schemehappens-';

/** Новая комната: 64 случайных бита, из контакта не выводится. */
export function jitsiRoom(): string {
  return `${JITSI_PREFIX}${randomBytes(8).toString('hex')}`;
}

/** Комната по старой формуле — адрес знает любой, кто знает контакт; узнаётся по форме (ключ строки теперь HMAC). */
export const isLegacyJitsiRoom = (url: string): boolean =>
  /^https:\/\/meet\.jit\.si\/schemehappens-[0-9a-f]{12}$/.test(url);

/**
 * Ссылка для повторной брони клиента. Комната по старой формуле заменяется
 * случайной (`replaced` — владелец узнаёт из DM) и записывается в ClientMeeting
 * условно, по прежнему шифротексту: два одновременных подтверждения одного
 * клиента не выписывают две комнаты, проигравший берёт комнату победителя.
 */
export async function reuseClientRoom(
  prisma: PrismaService,
  logger: Logger,
  row: { clientKey: string; meetingUrl: string },
): Promise<MeetingLink> {
  const key = row.clientKey;
  const url = decrypt(row.meetingUrl) ?? '';
  if (!isLegacyJitsiRoom(url)) {
    logger.log(`Reusing personal meeting for client ${key.slice(0, 11)}…`);
    return { url, replaced: false };
  }
  const fresh = jitsiRoom();
  const res = await prisma.clientMeeting.updateMany({
    where: { clientKey: key, meetingUrl: row.meetingUrl },
    data: { meetingUrl: encrypt(fresh) ?? fresh },
  });
  if (res.count === 0) {
    const won = await prisma.clientMeeting.findUnique({
      where: { clientKey: key },
    });
    // Строку удалили между чтением и записью: fresh не записан, бронь берёт его.
    if (!won) logger.warn(`ClientMeeting of ${key.slice(0, 11)}… vanished`);
    return { url: (won && decrypt(won.meetingUrl)) || fresh, replaced: true };
  }
  logger.log(`Replaced computable Jitsi room of client ${key.slice(0, 11)}…`);
  return { url: fresh, replaced: true };
}
