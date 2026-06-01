import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';

const MAX_NAME = 100;
const MAX_QUAL = 500;
const MAX_CONTACTS = 200;
const MAX_MSG = 1000;

@Injectable()
export class TherapistRequestService {
  private readonly logger = new Logger(TherapistRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botService: BotService,
  ) {}

  // Raw Telegram Bot API call. Avoids depending on Telegraf instance and
  // the circular-import that would create (TelegramModule ↔ TherapyModule).
  private async sendTg(chatId: number, text: string, replyMarkup?: object): Promise<void> {
    const token = process.env.BOT_TOKEN;
    if (!token) return;
    const body: any = { chat_id: chatId, text, parse_mode: 'Markdown' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    let res: Response | null = null;
    try {
      res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e: any) {
      this.logger.warn(`sendTg network error: ${e.message}`);
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { description?: string };
      this.logger.warn(`sendTg ${res.status} for chat_id=${chatId}: ${err.description ?? ''}`);
    }
  }

  private get adminId(): number | null {
    const raw = process.env.ADMIN_ID;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  // Anyone can submit one request. Re-submitting while pending is rejected.
  // Re-submitting after rejection is allowed (overwrites the previous row).
  async submit(userId: bigint, input: {
    fullName: string; qualification: string; contacts: string; message?: string;
  }): Promise<{ id: number; status: string }> {
    const role = await this.botService.getUserRole(userId);
    if (role === 'THERAPIST') throw new ConflictException('You are already a therapist');

    const fullName = (input.fullName ?? '').trim();
    const qualification = (input.qualification ?? '').trim();
    const contacts = (input.contacts ?? '').trim();
    const message = (input.message ?? '').trim() || null;
    if (!fullName || fullName.length > MAX_NAME) throw new BadRequestException('Invalid fullName');
    if (!qualification || qualification.length > MAX_QUAL) throw new BadRequestException('Invalid qualification');
    if (!contacts || contacts.length > MAX_CONTACTS) throw new BadRequestException('Invalid contacts');
    if (message && message.length > MAX_MSG) throw new BadRequestException('Message too long');

    const existing = await (this.prisma as any).therapistRequest.findUnique({ where: { userId } });
    if (existing?.status === 'pending') throw new ConflictException('Request already pending');
    if (existing?.status === 'approved') throw new ConflictException('Request already approved');

    const row = existing
      ? await (this.prisma as any).therapistRequest.update({
          where: { userId },
          data: { fullName, qualification, contacts, message, status: 'pending',
                  reviewedAt: null, reviewedBy: null, rejectReason: null },
        })
      : await (this.prisma as any).therapistRequest.create({
          data: { userId, fullName, qualification, contacts, message, status: 'pending' },
        });

    this.notifyAdmin(row).catch((e) => this.logger.warn(`notifyAdmin failed: ${e.message}`));
    return { id: row.id, status: row.status };
  }

  async getMine(userId: bigint) {
    return (this.prisma as any).therapistRequest.findUnique({
      where: { userId },
      select: { id: true, status: true, rejectReason: true, createdAt: true, reviewedAt: true },
    });
  }

  // ─── Admin actions ─────────────────────────────────────────────────────────

  private assertAdmin(adminId: number): void {
    if (this.adminId == null || adminId !== this.adminId) throw new ForbiddenException('Admin only');
  }

  async listPending(adminId: number) {
    this.assertAdmin(adminId);
    return (this.prisma as any).therapistRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(adminId: number, requestId: number) {
    this.assertAdmin(adminId);
    const req = await (this.prisma as any).therapistRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'pending') throw new ConflictException(`Request is ${req.status}`);

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).therapistRequest.update({
        where: { id: requestId },
        data: { status: 'approved', reviewedAt: new Date(), reviewedBy: BigInt(adminId), rejectReason: null },
      });
      await tx.user.update({ where: { id: req.userId }, data: { role: 'THERAPIST', therapistMode: true } });
    });

    this.notifyApplicant(Number(req.userId), 'approved').catch(() => null);
    this.logger.log(`Therapist request ${requestId} approved by admin ${adminId} → user ${req.userId}`);
  }

  async reject(adminId: number, requestId: number, reason: string) {
    this.assertAdmin(adminId);
    const req = await (this.prisma as any).therapistRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'pending') throw new ConflictException(`Request is ${req.status}`);

    await (this.prisma as any).therapistRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', reviewedAt: new Date(), reviewedBy: BigInt(adminId), rejectReason: reason?.slice(0, 500) || null },
    });
    this.notifyApplicant(Number(req.userId), 'rejected', reason).catch(() => null);
    this.logger.log(`Therapist request ${requestId} rejected by admin ${adminId}`);
  }

  // ─── Telegram notifications ───────────────────────────────────────────────

  private async notifyAdmin(req: { id: number; userId: bigint; fullName: string; qualification: string; contacts: string; message: string | null }) {
    if (!this.adminId) return;
    const text =
      `🩺 *Заявка на роль терапевта* #${req.id}\n\n` +
      `*Имя:* ${esc(req.fullName)}\n` +
      `*Квалификация:* ${esc(req.qualification)}\n` +
      `*Контакты:* ${esc(req.contacts)}\n` +
      (req.message ? `*Сообщение:* ${esc(req.message)}\n` : '') +
      `*Telegram ID:* \`${req.userId}\``;
    await this.sendTg(this.adminId, text, {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `treq:approve:${req.id}` },
        { text: '❌ Reject',  callback_data: `treq:reject:${req.id}` },
      ]],
    });
  }

  private async notifyApplicant(userId: number, decision: 'approved' | 'rejected', reason?: string) {
    const text = decision === 'approved'
      ? '✅ Твоя заявка на роль терапевта одобрена. Перезапусти приложение чтобы увидеть кабинет терапевта.'
      : `❌ Твоя заявка на роль терапевта отклонена.${reason ? `\n\nПричина: ${reason}` : ''}`;
    await this.sendTg(userId, text);
  }
}

function esc(s: string): string {
  // Telegram legacy Markdown escape
  return s.replace(/[_*`\[\]]/g, (m) => '\\' + m);
}
