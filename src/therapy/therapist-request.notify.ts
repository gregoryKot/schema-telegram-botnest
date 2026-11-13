import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../bot/account.service';
import { EmailService } from '../auth/email.service';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { practiceOwnerTelegramId } from '../utils/practice-owner';
import { DecisionRequest, deliverDecision } from './therapist-request.deliver';
import {
  decisionKeyboard,
  therapistRequestCard,
  therapistRequestEmail,
  type TherapistRequestFull,
} from './therapist-request.card';

// Телеграм-уведомления заявки на роль терапевта, вынесены из
// TherapistRequestService (правило №10 CLAUDE.md — лимит размера файла).
@Injectable()
export class TherapistRequestNotifyService {
  private readonly logger = new Logger(TherapistRequestNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: AccountService,
    private readonly email: EmailService,
  ) {}

  // Raw Telegram Bot API call. Avoids depending on Telegraf instance and
  // the circular-import that would create (TelegramModule ↔ TherapyModule).
  // Uses HTML parse_mode (applicant decisions carry an escaped reason).
  // Returns true only when Telegram accepted the message (false — e.g. after a
  // bot migration the admin hasn't opened the new bot yet); the applicant's
  // decision then falls back to e-mail, the request itself is always e-mailed.
  private async sendTg(
    chatId: number | bigint,
    text: string,
    replyMarkup?: object,
  ): Promise<boolean> {
    const token = process.env.BOT_TOKEN;
    if (!token) {
      this.logger.warn('sendTg: BOT_TOKEN not set');
      return false;
    }
    const body: {
      chat_id: number;
      text: string;
      parse_mode: string;
      reply_markup?: object;
    } = { chat_id: Number(chatId), text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    let res: Response | undefined;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`sendTg network error to chat_id=${chatId}: ${msg}`);
      return false;
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        description?: string;
      };
      this.logger.warn(
        `sendTg HTTP ${res.status} for chat_id=${chatId}: ${err.description ?? '(no description)'}`,
      );
      return false;
    }
    return true;
  }

  private get adminId(): number | null {
    return practiceOwnerTelegramId();
  }

  /**
   * Заявка владельцу: письмо с данными — всегда (без него решать не на чем),
   * Telegram — карточка без данных заявителя, с кнопками решения.
   */
  async notifyAdmin(req: TherapistRequestFull & { createdAt?: Date | null }) {
    const subject = `🩺 Заявка на роль терапевта #${req.id}`;
    const mailed = notifyAdminWithFallback(
      therapistRequestEmail(req),
      subject,
      { skipTelegram: true },
    );
    if (!this.adminId) {
      this.logger.error(
        'notifyAdmin: ADMIN_ID not set — request in e-mail only',
      );
      await mailed;
      return;
    }
    const text = `${therapistRequestCard(req)}\n\nСписок заявок: /zayavki`;
    const [delivered] = await Promise.all([
      this.sendTg(this.adminId, text, decisionKeyboard(req.id)),
      mailed,
    ]);
    if (!delivered)
      this.logger.error(
        `notifyAdmin: Telegram DM to admin failed for request #${req.id} — e-mail only`,
      );
  }

  // Решение заявителю: Telegram → письмо → logger.error (см. deliver.ts).
  notifyApplicant(a: DecisionRequest): Promise<void> {
    return deliverDecision(
      {
        prisma: this.prisma,
        accountService: this.accountService,
        email: this.email,
        logger: this.logger,
        sendTg: (chatId, text) => this.sendTg(chatId, text),
      },
      a,
    );
  }
}
