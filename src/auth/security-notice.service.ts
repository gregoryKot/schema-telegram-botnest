// Уведомление владельцу аккаунта о событии безопасности (S11/S12, аудит
// 2026-11). Каналы — существующие, новых не заводим:
//   - письмо через EmailService, если у аккаунта есть вход по почте;
//   - сообщение бота через очередь уведомлений (ScheduledNotification, тип
//     `security_notice`, без тихих часов), если есть вход через Telegram.
// Без каналов — только строка в журнале безопасности, которую пишет
// вызывающий. Ничего не бросает: уведомление — след, а не условие действия.
// Отвязанный адрес почты получает письмо тоже (хвост S12): если отвязал не
// владелец почты, это его единственный сигнал — в аккаунт он уже не войдёт.
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
  notify(userId: bigint, notice: SecurityNotice, alsoTo: string[] = []): void {
    this.deliver(userId, notice, alsoTo).catch((err: Error) =>
      this.logger.warn(
        `уведомление ${notice.kind} для ${userId} не ушло: ${err.message}`,
      ),
    );
  }

  linked(userId: bigint, provider: string): void {
    this.notify(userId, { kind: 'provider_linked', provider });
  }

  /** Адреса почтового входа — читать ДО отвязки; сбой чтения не мешает ей. */
  async emailAddresses(userId: bigint): Promise<string[]> {
    const rows = await this.prisma.authProvider
      .findMany({
        where: { userId, provider: 'email' },
        select: { providerId: true },
      })
      .catch((): { providerId: string }[] => []);
    return rows.map((r) => r.providerId);
  }

  /** `alsoTo` — адреса, которых у аккаунта уже нет (отвязанная почта). */
  async deliver(
    userId: bigint,
    notice: SecurityNotice,
    alsoTo: string[] = [],
  ): Promise<void> {
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
    const to = new Set([...(mail ? [mail.providerId] : []), ...alsoTo]);
    if (to.size > 0) {
      const form = normalizeAddressForm(user?.addressForm);
      const { subject, body } = securityNoticeText(notice, form);
      for (const addr of to) jobs.push(this.email.send(addr, subject, body));
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
