// Уведомление владельцу аккаунта о событии безопасности (S11/S12, аудит
// 2026-11). Каналы — существующие, новых не заводим:
//   - письмо через EmailService, если у аккаунта есть вход по почте;
//   - сообщение бота через очередь уведомлений (ScheduledNotification, тип
//     `security_notice`, без тихих часов), если есть вход через Telegram.
// Без каналов — только строка в журнале безопасности, которую пишет
// вызывающий. Ничего не бросает: уведомление — след, а не условие действия.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { normalizeAddressForm } from '../notification/address-form';
import { EmailService } from './email.service';
import { telegramIdFor } from './telegram-identity';
import {
  securityNoticeText,
  type SecurityNotice,
} from './security-notice.texts';

@Injectable()
export class SecurityNoticeService {
  private readonly logger = new Logger(SecurityNoticeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationService,
  ) {}

  /** Fire-and-forget: ответ на запрос не ждёт почты и очереди. */
  notify(userId: bigint, notice: SecurityNotice): void {
    this.deliver(userId, notice).catch((err: Error) =>
      this.logger.warn(
        `уведомление ${notice.kind} для ${userId} не ушло: ${err.message}`,
      ),
    );
  }

  linked(userId: bigint, provider: string): void {
    this.notify(userId, { kind: 'provider_linked', provider });
  }

  async deliver(userId: bigint, notice: SecurityNotice): Promise<void> {
    const [user, mail, chatId] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { addressForm: true },
      }),
      // providerId почтового входа — сам адрес (нижний регистр), по нему лукап.
      this.prisma.authProvider.findFirst({
        where: { userId, provider: 'email' },
        select: { providerId: true },
        orderBy: { id: 'desc' },
      }),
      telegramIdFor(this.prisma, userId),
    ]);
    const jobs: Promise<unknown>[] = [];
    if (mail) {
      const form = normalizeAddressForm(user?.addressForm);
      const { subject, body } = securityNoticeText(notice, form);
      jobs.push(this.email.send(mail.providerId, subject, body));
    }
    if (chatId !== null) {
      jobs.push(
        this.notifications.schedule(userId, 'security_notice', new Date(), {
          ...notice,
        }),
      );
    }
    await Promise.all(jobs);
  }
}
