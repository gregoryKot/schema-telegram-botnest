// Строки очереди, которые некому доставить. Вынесено из
// telegram.schedule-queue.ts (правило №10).
//
// Писать некуда: ни подписки на уведомления в приложении, ни телеграм-входа
// (Google, почта, MAX) либо аккаунт слит, и адрес уехал вместе с
// AuthProvider. Строку отменяем — именно cancelledAt, а не markSent: sentAt
// читает lastSentAt(), на нём стоит каденс, и «отправлено» без отправки
// сдвинуло бы расписание. И ни в коем случае не markUserBlocked: человек
// бота не блокировал. В лог — одна строка на тик: авария — это поток, и
// сотня строк равна замьюченному логу (урок 2026-07-29).
import type { Logger } from '@nestjs/common';
import type { NotificationService } from '../notification/notification.service';
import { undeliveredFromOther } from '../notification/notification-channels';

// Сколько userId показать в итоговой строке про «некуда слать».
const NO_ADDRESS_SAMPLE = 5;

export class NoAddressRows {
  private readonly userIds: string[] = [];
  private readonly types: string[] = []; // класс 20: notification-channels.ts

  constructor(
    private readonly notifications: Pick<NotificationService, 'cancelOne'>,
  ) {}

  async cancel(n: { id: number; userId: bigint; type: string }) {
    await this.notifications.cancelOne(n.id);
    this.userIds.push(String(n.userId));
    this.types.push(n.type);
  }

  report(logger: Pick<Logger, 'warn'>): void {
    const ids = this.userIds;
    if (ids.length === 0) return;
    logger.warn(
      `Очередь: ${ids.length} уведомлений некому доставить — у аккаунта ` +
        `нет ни входа в Telegram, ни уведомлений в приложении. userId: ` +
        `${ids.slice(0, NO_ADDRESS_SAMPLE).join(', ')}` +
        `${ids.length > NO_ADDRESS_SAMPLE ? ' …' : ''}` +
        undeliveredFromOther(this.types),
    );
  }
}
