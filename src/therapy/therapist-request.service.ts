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
import { TherapistRequestNotifyService } from './therapist-request.notify';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';

const MAX_NAME = 100;
const MAX_QUAL = 500;
const MAX_CONTACTS = 200;
const MAX_MSG = 1000;

// ФИО, квалификация, контакты и сопроводительное письмо — PII в свободном
// тексте, шифруются как и остальной пользовательский текст (правило
// «Шифрование» из чеклиста новых таблиц). Легаси plaintext-строки читаются
// как есть (decrypt plaintext-tolerant).
const REQUEST_SCHEMA: EncryptSchema = {
  strings: ['fullName', 'qualification', 'contacts', 'message'],
};

@Injectable()
export class TherapistRequestService {
  private readonly logger = new Logger(TherapistRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: AccountService,
    private readonly securityLog: SecurityLogService,
    private readonly notify: TherapistRequestNotifyService,
  ) {}

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

    const fields = encryptRecord(
      { fullName, qualification, contacts, message },
      REQUEST_SCHEMA,
    );
    const row = existing
      ? await this.prisma.therapistRequest.update({
          where: { userId },
          data: {
            ...fields,
            status: 'pending',
            reviewedAt: null,
            reviewedBy: null,
            rejectReason: null,
          },
        })
      : await this.prisma.therapistRequest.create({
          data: { userId, ...fields, status: 'pending' },
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
    // В Telegram/e-mail админу уходит plaintext (row в БД — шифрованный).
    this.notify
      .notifyAdmin({
        ...row,
        fullName,
        qualification,
        contacts,
        message,
      })
      .catch((e: unknown) =>
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
    const rows = await this.prisma.therapistRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      // D-4 (аудит 2026-07): страховка от роста таблицы (не пагинация) —
      // админский список заявок не должен читаться без ограничения.
      take: 5000,
    });
    return rows.map((r) => decryptRecord(r, REQUEST_SCHEMA));
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
    this.notify
      .notifyApplicant(Number(reqUserId), 'approved')
      .catch((e: unknown) => this.logger.error('notifyApplicant failed', e));
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
    this.notify
      .notifyApplicant(Number(req.userId), 'rejected', reason)
      .catch((e: unknown) => this.logger.error('notifyApplicant failed', e));
    this.logger.log(
      `Therapist request ${requestId} rejected by admin ${adminId}`,
    );
  }
}
