import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt, encrypt } from '../utils/crypto';

// Комната Jitsi клиента (аудит 2026-10, утечка ссылки на встречу). Раньше адрес
// считался из контакта: `schemehappens-<sha256(контакт)[0..12]>` — любой, кто
// знает контакт клиента, вычислял его комнату без единого запроса (пароля и
// зала ожидания у meet.jit.si нет). Теперь имя случайное: адрес хранится в
// ClientMeeting (зашифрован, D-9) и не пересчитывается, детерминизм не нужен.

const JITSI_PREFIX = 'https://meet.jit.si/schemehappens-';

/** Новая комната: 64 случайных бита, из контакта не выводится. */
export function jitsiRoom(): string {
  return `${JITSI_PREFIX}${randomBytes(8).toString('hex')}`;
}

/** Комната по старой формуле — её адрес знает любой, кто знает контакт. */
export function isLegacyJitsiRoom(url: string, key: string): boolean {
  return url === `${JITSI_PREFIX}${key.slice(0, 12)}`;
}

/**
 * Ссылка для повторной брони клиента. Комната по старой формуле заменяется
 * случайной и записывается в ClientMeeting (тот же приём, что апгрейд до Zoom),
 * остальные переиспользуются как есть. Запись условная — по прежнему
 * шифротексту: два одновременных подтверждения одного клиента не выписывают
 * две разные комнаты, проигравший берёт ту, что записал победитель.
 */
export async function reuseClientRoom(
  prisma: PrismaService,
  logger: Logger,
  row: { clientKey: string; meetingUrl: string },
): Promise<string> {
  const key = row.clientKey;
  const url = decrypt(row.meetingUrl) ?? '';
  if (!isLegacyJitsiRoom(url, key)) {
    logger.log(`Reusing personal meeting for client ${key.slice(0, 8)}…`);
    return url;
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
    return (won && decrypt(won.meetingUrl)) || fresh;
  }
  logger.log(`Replaced computable Jitsi room of client ${key.slice(0, 8)}…`);
  return fresh;
}
