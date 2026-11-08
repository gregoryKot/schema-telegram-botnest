import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isNotifyTimezone } from '../notification/notify-timezones';
import { adoptDeviceTimezone } from './device-timezone';
import { canonicalUserId, telegramIdsFor } from '../auth/telegram-identity';
import { WEB_USER_ID_MIN, isTelegramUserId } from '../auth/user-id-range';
import { deleteAllUserData } from './account.delete';
// Реестр живёт отдельным файлом (им пользуется и account.delete.ts);
// ре-экспорт — чтобы импорты соседей и спек продолжали работать.
export { USER_DATA_TABLES } from './user-data-tables';
import {
  SEND_SETTINGS_SELECT,
  toSendSettings,
  type SendSettings,
} from './send-settings';
export type { SendSettings } from './send-settings';

// Жизненный цикл аккаунта: регистрация/идентичность, роль, статус блокировки
// бота, списки для рассылок и полное удаление (right-to-erasure).
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  // `timezone` — пояс устройства (/api/init): см. device-timezone.ts. true —
  // пояс уже существующего юзера сменился, напоминание надо перепланировать.
  async registerUser(
    userId: bigint,
    firstName?: string,
    timezone?: string,
  ): Promise<boolean> {
    const validTz = isNotifyTimezone(timezone);
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {
        ...(firstName ? { firstName } : {}),
        botBlockedAt: null,
        deletedAt: null,
      },
      create: {
        id: userId,
        firstName,
        ...(validTz ? { notifyTimezone: timezone } : {}),
      },
    });
    return validTz ? adoptDeviceTimezone(this.prisma, userId, timezone) : false;
  }

  async getUserFirstName(userId: bigint): Promise<string | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });
    return u?.firstName ?? null;
  }

  async updateName(userId: bigint, name: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: name },
    });
  }

  async getUserRole(userId: bigint): Promise<'CLIENT' | 'THERAPIST'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role ?? 'CLIENT';
  }

  // Запоминает, в каком представлении терапевт хочет стартовать (кабинет vs
  // клиентский режим). `therapistMode` — серверный источник правды: localStorage
  // в Telegram WebView ненадёжен и стирается, из-за чего терапевт «терял» кабинет.
  // Вызывается только после проверки роли THERAPIST в контроллере (клиент не
  // может поднять себе therapistMode — это privilege escalation в UI терапевта).
  async setTherapistMode(userId: bigint, on: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { therapistMode: on },
    });
  }

  async markUserBlocked(userId: bigint): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, botBlockedAt: null },
      data: { botBlockedAt: new Date() },
    });
  }

  /** Кому рассылка вообще адресована. bigint как есть: номер не округляется. */
  async getBroadcastUserIds(): Promise<bigint[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, botBlockedAt: null },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /**
   * Кого планировщик вообще рассматривает. Отсекаем тех, кому бот физически
   * не может написать: вход через Google, почту или MAX даёт userId в
   * веб-диапазоне, чата с таким номером не существует. Раньше их всё равно
   * ставили в очередь, отправка падала, и человек молча получал
   * `botBlockedAt` — уведомления выключались навсегда у того, кто ни о чём
   * не просил.
   *
   * Отсекаем ИМЕННО здесь, до создания строки: тогда веха (streak_7 и
   * соседи) не сгорает у человека, который привяжет Telegram позже.
   */
  async getAllUsersWithSettings() {
    return this.prisma.user.findMany({
      where: {
        notifyEnabled: true,
        botBlockedAt: null,
        deletedAt: null,
        // Либо есть привязка к Telegram, либо номер сам телеграмный (старый
        // пользователь бота без строки AuthProvider). Веб-номер без привязки
        // отсекаем: чата по нему нет, и раньше такие люди молча копили
        // botBlockedAt на неудачных отправках.
        OR: [
          { authProviders: { some: { provider: 'telegram' } } },
          { id: { lt: WEB_USER_ID_MIN } },
        ],
      },
      select: {
        id: true,
        notifyLocalHour: true,
        notifyTimezone: true,
        notifyReminderEnabled: true,
        notifyGamified: true,
        notifyFrequency: true,
        notifyAdaptiveLevel: true,
        notifyIgnoredCount: true,
        notifyNextRemindDate: true,
        notifySkipAckDate: true,
        notifyLastEvalDate: true,
        notifyPausedUntil: true,
        addressForm: true,
      },
    });
  }

  /** Явный выбор частоты сбрасывает адаптацию на выбранный уровень */
  async setAdaptiveLevel(userId: bigint, level: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { notifyAdaptiveLevel: level, notifyIgnoredCount: 0 },
    });
  }

  /** Тихие часы, пауза, пояс, форма и адрес для пачки юзеров (processQueue) */
  async getSendSettingsFor(ids: bigint[]): Promise<Map<string, SendSettings>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: SEND_SETTINGS_SELECT,
    });
    return new Map(rows.map((r) => [r.id.toString(), toSendSettings(r)]));
  }

  /**
   * Доходят ли до человека уведомления: тот же адрес, по которому их шлёт
   * очередь (getSendSettingsFor → chatId). QA 2026-11 (З5): веб-клиент без
   * Telegram видел включённые тумблеры, а очередь снимала его уведомления
   * как «доставить некому».
   */
  async isNotifyReachable(userId: bigint): Promise<boolean> {
    const s = await this.getSendSettingsFor([userId]);
    return (s.get(userId.toString())?.chatId ?? null) !== null;
  }

  /**
   * Полное удаление аккаунта — тело транзакции в account.delete.ts
   * (правило №10: два десятка таблиц не живут внутри сервиса).
   */
  async deleteAllUserData(userId: bigint): Promise<void> {
    return deleteAllUserData(this.prisma, this.logger, userId);
  }

  /**
   * Чей это аккаунт по адресу в Telegram. Хендлеры бота знают только
   * `ctx.from.id`, а после слияния аккаунтов он уже НЕ равен userId — данные
   * человека лежат под веб-номером, и запись по сырому telegramId создала бы
   * второй, пустой аккаунт. Единственная реализация — auth/telegram-identity.
   */
  async canonicalUserId(telegramId: number | bigint): Promise<bigint> {
    return canonicalUserId(this.prisma, telegramId);
  }

  /**
   * Адреса в Telegram для пачки аккаунтов (рассылка). Тот же фолбэк, что и у
   * очереди: телеграмный номер без привязки — сам себе адрес, иначе рассылка
   * перестала бы доходить до старых пользователей бота.
   */
  async telegramIdsFor(userIds: bigint[]): Promise<Map<string, bigint>> {
    const linked = await telegramIdsFor(this.prisma, userIds);
    for (const id of userIds) {
      const key = id.toString();
      if (!linked.has(key) && isTelegramUserId(id)) linked.set(key, id);
    }
    return linked;
  }
}
