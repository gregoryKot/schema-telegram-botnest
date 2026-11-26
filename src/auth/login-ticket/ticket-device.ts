// Экран сверки входа `/auth/confirm` (S9, аудит 2026-11): какое устройство и
// когда просило вход. Билет входа открывает ДРУГОЙ контейнер (мини-апп уводит
// во внешний браузер, у ярлыка своя банка кук), поэтому чей билет — решает
// человек: код набирается руками, рядом видно устройство и время.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../email.util';

/** Что видит человек на экране сверки входа. */
export interface LoginTicketPreview {
  deviceLabel: string | null;
  createdAt: string;
}

@Injectable()
export class TicketDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Экран /auth/confirm: какое устройство и когда просило вход; иначе 404. */
  async preview(userCode: string): Promise<LoginTicketPreview> {
    const row = await this.pendingLogin(userCode);
    if (!row) throw new NotFoundException();
    return {
      deviceLabel: row.deviceLabel || null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // Только вход (handoff короткий код никому не показывает, привязка
  // сверяется своим preview), не погашенный, не отклонённый, не одобренный.
  private async pendingLogin(userCode: string) {
    const row = await this.prisma.loginTicket.findUnique({
      where: { userCodeHash: hashToken(userCode.trim().toUpperCase()) },
    });
    if (!row || row.intent !== 'login') return null;
    if (row.consumedAt || row.deniedAt || row.approvedUserId !== null)
      return null;
    return row.expiresAt < new Date() ? null : row;
  }
}
