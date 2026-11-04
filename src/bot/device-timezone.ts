import type { PrismaService } from '../prisma/prisma.service';

/**
 * Пояс устройства → notifyTimezone, пока человек не выбрал пояс сам
 * (notifyTimezoneChosen ставит запись настроек, user-settings-write.ts). Без
 * этого «сегодня» сервера — серия, недельная полоса, напоминания — у любого
 * клиента жило по Москве (QA 2026-11-03). Одним условным UPDATE: выбор,
 * сделанный в эту же секунду на другом устройстве, не перетирается.
 * true — пояс сменился.
 */
export async function adoptDeviceTimezone(
  prisma: PrismaService,
  userId: bigint,
  timezone: string,
): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      notifyTimezoneChosen: false,
      NOT: { notifyTimezone: timezone },
    },
    data: { notifyTimezone: timezone },
  });
  return count > 0;
}
