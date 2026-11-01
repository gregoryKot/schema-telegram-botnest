import type { PrismaService } from '../prisma/prisma.service';
import {
  encryptRecord,
  guardOverwrite,
  type EncryptSchema,
} from '../utils/crypto-record';

// Запись настроек юзера (POST /api/settings → BotService.updateUserSettings).
// mySchemaIds/myModeIds — зашифрованные JSON-списки, пишутся целиком.
export interface UserSettingsPatch {
  notifyEnabled?: boolean;
  notifyLocalHour?: number;
  notifyTimezone?: string;
  notifyReminderEnabled?: boolean;
  notifyFrequency?: number;
  notifyQuietStart?: number;
  notifyQuietEnd?: number;
  notifyGamified?: boolean;
  notifyPausedUntil?: Date | null;
  addressForm?: string;
  pairCardDismissed?: boolean;
  mySchemaIds?: string[];
  myModeIds?: string[];
  therapistShareCards?: boolean;
  therapistShareProfile?: boolean;
  uiPrefs?: Record<string, string>;
}

const LISTS_SCHEMA: EncryptSchema = {
  model: 'user',
  jsonArrays: ['mySchemaIds', 'myModeIds'],
};

export async function writeUserSettings(
  prisma: PrismaService,
  userId: bigint,
  data: UserSettingsPatch,
): Promise<void> {
  await guardListOverwrite(prisma, userId, data);
  const enc = encryptRecord(data as Record<string, unknown>, LISTS_SCHEMA);
  await prisma.user.update({ where: { id: userId }, data: enc });
}

// Нечитаемый список (ключ не подошёл) ушёл клиенту как `[]`, и клиент прислал
// свой список целиком: запись стёрла бы живой шифротекст навсегда. Отказ —
// 409 { reason: 'unreadable_data' } (guardOverwrite), в БД не меняется ничего,
// включая остальные поля той же правки: фронтенды шлют списки отдельным
// запросом. Список, который правка не трогает, записи не мешает.
async function guardListOverwrite(
  prisma: PrismaService,
  userId: bigint,
  data: UserSettingsPatch,
): Promise<void> {
  const lists: Record<string, unknown> = {};
  if (data.mySchemaIds !== undefined) lists.mySchemaIds = data.mySchemaIds;
  if (data.myModeIds !== undefined) lists.myModeIds = data.myModeIds;
  if (Object.keys(lists).length === 0) return;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { mySchemaIds: true, myModeIds: true },
  });
  if (!row) return;
  guardOverwrite(row, LISTS_SCHEMA, lists, `settings user#${userId}`);
}
