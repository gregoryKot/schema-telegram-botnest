import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notifyAdminWithFallback } from '../utils/admin-alert';
import { normalizeAddressForm, t } from '../notification/address-form';

// Телеграм-уведомления заявки на роль терапевта, вынесены из
// TherapistRequestService (правило №10 CLAUDE.md — лимит размера файла).
@Injectable()
export class TherapistRequestNotifyService {
  private readonly logger = new Logger(TherapistRequestNotifyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Raw Telegram Bot API call. Avoids depending on Telegraf instance and
  // the circular-import that would create (TelegramModule ↔ TherapyModule).
  // Uses HTML parse_mode to avoid legacy Markdown parse errors for arbitrary
  // user input (names, contacts, etc. may contain *, _, ., -, (, ) etc.).
  // Returns true only when Telegram accepted the message. Callers that must
  // reach the admin (notifyAdmin) fall back to e-mail when this returns false —
  // e.g. after a bot migration the admin hasn't opened the new bot yet, so the
  // DM fails and the request would otherwise vanish silently.
  private async sendTg(
    chatId: number,
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
    } = { chat_id: chatId, text, parse_mode: 'HTML' };
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
    const raw = process.env.ADMIN_ID;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  async notifyAdmin(req: {
    id: number;
    userId: bigint;
    fullName: string;
    qualification: string;
    contacts: string;
    message: string | null;
  }) {
    if (!this.adminId) {
      // Без ADMIN_ID пуш невозможен — но заявку всё равно надо доставить.
      this.logger.error(
        'notifyAdmin: ADMIN_ID not set — falling back to email',
      );
      await notifyAdminWithFallback(
        this.plainText(req),
        `🩺 Заявка на роль терапевта #${req.id}`,
      );
      return;
    }
    // HTML mode: escape user-supplied text to avoid parse errors.
    const text =
      `🩺 <b>Заявка на роль терапевта</b> #${req.id}\n\n` +
      `<b>Имя:</b> ${he(req.fullName)}\n` +
      `<b>Квалификация:</b> ${he(req.qualification)}\n` +
      `<b>Контакты:</b> ${he(req.contacts)}\n` +
      (req.message ? `<b>Сообщение:</b> ${he(req.message)}\n` : '') +
      `<b>Telegram ID:</b> <code>${req.userId}</code>\n\n` +
      `Список заявок: /zayavki`;
    const delivered = await this.sendTg(this.adminId, text, {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `treq:approve:${req.id}` },
          { text: '❌ Reject', callback_data: `treq:reject:${req.id}` },
        ],
      ],
    });
    // Пуш не дошёл (напр. после переезда бота админ ещё не нажал Start) —
    // гарантированная доставка через e-mail, чтобы заявка не потерялась.
    if (!delivered) {
      this.logger.error(
        `notifyAdmin: Telegram DM to admin failed for request #${req.id} — falling back to email`,
      );
      await notifyAdminWithFallback(
        this.plainText(req),
        `🩺 Заявка на роль терапевта #${req.id}`,
      );
    }
  }

  private plainText(req: {
    id: number;
    userId: bigint;
    fullName: string;
    qualification: string;
    contacts: string;
    message: string | null;
  }): string {
    return (
      `Новая заявка на роль терапевта #${req.id}\n\n` +
      `Имя: ${req.fullName}\n` +
      `Квалификация: ${req.qualification}\n` +
      `Контакты: ${req.contacts}\n` +
      (req.message ? `Сообщение: ${req.message}\n` : '') +
      `Telegram ID: ${req.userId}\n\n` +
      `Одобрить/отклонить: открой бот и напиши /zayavki`
    );
  }

  async notifyApplicant(
    userId: number,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    // Форма обращения — общая для бота/уведомлений/фронтендов (CLAUDE.md,
    // «Обращение ты/вы»). Сбой чтения не должен ронять доставку — шлём
    // с дефолтной формой «ты» (normalizeAddressForm(undefined)).
    const form = await this.prisma.user
      .findUnique({
        where: { id: BigInt(userId) },
        select: { addressForm: true },
      })
      .then((u) => normalizeAddressForm(u?.addressForm))
      .catch(() => normalizeAddressForm(undefined));

    const text =
      decision === 'approved'
        ? t(
            form,
            '✅ Твоя заявка на роль терапевта одобрена. Перезапусти приложение чтобы увидеть кабинет терапевта.',
            '✅ Ваша заявка на роль терапевта одобрена. Перезапустите приложение, чтобы увидеть кабинет терапевта.',
          )
        : t(
            form,
            `❌ Твоя заявка на роль терапевта отклонена.${reason ? `\n\nПричина: ${reason}` : ''}`,
            `❌ Ваша заявка на роль терапевта отклонена.${reason ? `\n\nПричина: ${reason}` : ''}`,
          );
    await this.sendTg(userId, text);
  }
}

function he(s: string): string {
  // HTML-escape for Telegram parse_mode: 'HTML'
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
