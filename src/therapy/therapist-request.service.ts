import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../bot/account.service';
import { SecurityLogService } from '../auth/security-log.service';
import { notifyAdminWithFallback } from '../utils/admin-alert';

const MAX_NAME = 100;
const MAX_QUAL = 500;
const MAX_CONTACTS = 200;
const MAX_MSG = 1000;

@Injectable()
export class TherapistRequestService {
  private readonly logger = new Logger(TherapistRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: AccountService,
    private readonly securityLog: SecurityLogService,
  ) {}

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

  // Anyone can submit one request. Re-submitting while pending is rejected.
  // Re-submitting after rejection is allowed (overwrites the previous row).
  async submit(
    userId: bigint,
    input: {
      fullName: string;
      qualification: string;
      contacts: string;
      message?: string;
    },
  ): Promise<{ id: number; status: string }> {
    const role = await this.accountService.getUserRole(userId);
    if (role === 'THERAPIST')
      throw new ConflictException('You are already a therapist');

    const fullName = (input.fullName ?? '').trim();
    const qualification = (input.qualification ?? '').trim();
    const contacts = (input.contacts ?? '').trim();
    const message = (input.message ?? '').trim() || null;
    if (!fullName || fullName.length > MAX_NAME)
      throw new BadRequestException('Invalid fullName');
    if (!qualification || qualification.length > MAX_QUAL)
      throw new BadRequestException('Invalid qualification');
    if (!contacts || contacts.length > MAX_CONTACTS)
      throw new BadRequestException('Invalid contacts');
    if (message && message.length > MAX_MSG)
      throw new BadRequestException('Message too long');

    const existing = await this.prisma.therapistRequest.findUnique({
      where: { userId },
    });
    if (existing?.status === 'pending')
      throw new ConflictException('Request already pending');
    if (existing?.status === 'approved')
      throw new ConflictException('Request already approved');

    const row = existing
      ? await this.prisma.therapistRequest.update({
          where: { userId },
          data: {
            fullName,
            qualification,
            contacts,
            message,
            status: 'pending',
            reviewedAt: null,
            reviewedBy: null,
            rejectReason: null,
          },
        })
      : await this.prisma.therapistRequest.create({
          data: {
            userId,
            fullName,
            qualification,
            contacts,
            message,
            status: 'pending',
          },
        });

    // Явный каст в одном месте — вместо `any`-member-access на каждое
    // обращение к row.id/row.status ниже (eslint-храповик, правило 9).
    const rowId = row.id;
    const rowStatus = row.status;

    this.securityLog.log('therapist_request_submitted', {
      userId,
      requestId: rowId,
      summary: qualification.slice(0, 120),
    });
    this.notifyAdmin(row).catch((e: unknown) =>
      this.logger.warn(
        `notifyAdmin failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
    return { id: rowId, status: rowStatus };
  }

  async getMine(userId: bigint) {
    return this.prisma.therapistRequest.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        rejectReason: true,
        createdAt: true,
        reviewedAt: true,
      },
    });
  }

  // ─── Admin actions ─────────────────────────────────────────────────────────

  private assertAdmin(adminId: number): void {
    if (this.adminId == null || adminId !== this.adminId)
      throw new ForbiddenException('Admin only');
  }

  async listPending(adminId: number) {
    this.assertAdmin(adminId);
    return this.prisma.therapistRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      // D-4 (аудит 2026-07): страховка от роста таблицы (не пагинация) —
      // админский список заявок не должен читаться без ограничения.
      take: 5000,
    });
  }

  async approve(adminId: number, requestId: number) {
    this.assertAdmin(adminId);
    const req = await this.prisma.therapistRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'pending')
      throw new ConflictException(`Request is ${req.status}`);
    // Явный каст в одном месте — вместо `any`-member-access на каждое
    // обращение к req.userId ниже (eslint-храповик, правило 9).
    const reqUserId = req.userId;

    await this.prisma.$transaction(async (tx) => {
      await tx.therapistRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: BigInt(adminId),
          rejectReason: null,
        },
      });
      await tx.user.update({
        where: { id: reqUserId },
        data: { role: 'THERAPIST', therapistMode: true },
      });
    });

    // Аудит эскалации привилегий: кто получил роль THERAPIST и кем (см.
    // CLAUDE.md «Аудит-события» / security-log.service.ts ALERT_EVENTS).
    this.securityLog.log('role_changed', {
      userId: reqUserId,
      role: 'THERAPIST',
      adminId,
      requestId,
    });
    this.notifyApplicant(Number(reqUserId), 'approved').catch(() => null);
    this.logger.log(
      `Therapist request ${requestId} approved by admin ${adminId} → user ${reqUserId}`,
    );
  }

  async reject(adminId: number, requestId: number, reason: string) {
    this.assertAdmin(adminId);
    const req = await this.prisma.therapistRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'pending')
      throw new ConflictException(`Request is ${req.status}`);

    await this.prisma.therapistRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: BigInt(adminId),
        rejectReason: reason?.slice(0, 500) || null,
      },
    });
    this.notifyApplicant(Number(req.userId), 'rejected', reason).catch(
      () => null,
    );
    this.logger.log(
      `Therapist request ${requestId} rejected by admin ${adminId}`,
    );
  }

  // ─── Telegram notifications ───────────────────────────────────────────────

  private async notifyAdmin(req: {
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

  private async notifyApplicant(
    userId: number,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    const text =
      decision === 'approved'
        ? '✅ Твоя заявка на роль терапевта одобрена. Перезапусти приложение чтобы увидеть кабинет терапевта.'
        : `❌ Твоя заявка на роль терапевта отклонена.${reason ? `\n\nПричина: ${reason}` : ''}`;
    await this.sendTg(userId, text);
  }
}

function he(s: string): string {
  // HTML-escape for Telegram parse_mode: 'HTML'
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
